import { createSSEClientState } from "../client/client-state";
import { createLocalSSEClient } from "../client/create-local-sse-client";
import type { SSEClient, SSEClientDependencies } from "../client/create-local-sse-client";
import {
  dispatchSSEEvent,
  parseEventPayload,
  parseEventPayloadStrict
} from "../events/dispatch-sse-event";
import { normalizeError } from "../errors/sse-error";
import type { ParsedSSEEvent } from "../parser/parse-sse-chunk";
import type {
  EventHandler,
  EventMap,
  SSEAnyEventHandler,
  SSEClientOptions,
  SSEError
} from "../types/public";
import type { CoordinationBackend, CoordinationChannel } from "./coordination-backend";
import type { CoordinationMessage } from "./coordination-message";
import { createChannelName } from "./create-channel-name";

/**
 * Single-tab coordination.
 *
 * Tabs sharing the same `key` compete for leadership (via the backend's
 * `requestLeadership`). Exactly one tab — the leader — opens the real SSE
 * connection and forwards every parsed event, status change, and error to the
 * other tabs over a broadcast channel. Followers dispatch those events to their
 * own handlers and mirror the leader's status without opening a connection.
 *
 * If the leader goes away (manual disconnect or the tab closes), the backend
 * grants leadership to a waiting follower, which transparently takes over.
 */
export function createCoordinatedSSEClient<Events extends EventMap>(
  options: SSEClientOptions<Events>,
  dependencies: SSEClientDependencies,
  backend: CoordinationBackend
): SSEClient<Events> {
  const channelName = createChannelName(options.key);
  const state = createSSEClientState(options.enabled === false ? "idle" : "closed");

  type AnyHandler = (payload: unknown) => void | Promise<void>;
  const subscriberRegistry = new Map<string, Set<AnyHandler>>();
  const anyEventHandlers = new Set<SSEAnyEventHandler>();

  let channel: CoordinationChannel | null = null;
  let unsubscribeChannel: (() => void) | null = null;
  let leadershipController: AbortController | null = null;
  let engine: SSEClient<Events> | null = null;
  let engineSubscriptions: Array<() => void> = [];
  let isActive = false;

  return {
    connect,
    disconnect,

    subscribeEvent<EventName extends keyof Events>(
      eventName: EventName,
      handler: EventHandler<Events[EventName]>
    ): () => void {
      const key = String(eventName);
      let handlers = subscriberRegistry.get(key);
      if (!handlers) {
        handlers = new Set<AnyHandler>();
        subscriberRegistry.set(key, handlers);
      }
      const anyHandler = handler as unknown as AnyHandler;
      handlers.add(anyHandler);
      return () => {
        subscriberRegistry.get(key)?.delete(anyHandler);
      };
    },

    subscribeAnyEvent(handler: SSEAnyEventHandler): () => void {
      anyEventHandlers.add(handler);
      return () => {
        anyEventHandlers.delete(handler);
      };
    },

    getError: state.getError,
    getStatus: state.getStatus,
    subscribeError: state.subscribeError,
    subscribeStatus: state.subscribeStatus
  };

  async function connect(): Promise<void> {
    if (isActive) {
      return;
    }

    isActive = true;
    channel = backend.createChannel(channelName);
    unsubscribeChannel = channel.subscribe(handleMessage);

    // Ask the current leader (if any) for a status snapshot while we wait.
    channel.post({ type: "hello" });

    const controller = new AbortController();
    leadershipController = controller;
    callDiagnostic(options.diagnostics?.onCoordinationRoleChange, { role: "follower" });

    void backend
      .requestLeadership(channelName, controller.signal)
      .then(() => {
        if (isActive && !controller.signal.aborted) {
          becomeLeader();
        }
      })
      .catch(() => {
        // Leadership request was aborted by disconnect before it was granted.
      });
  }

  function disconnect(): void {
    isActive = false;
    teardownEngine();
    leadershipController?.abort();
    leadershipController = null;
    unsubscribeChannel?.();
    unsubscribeChannel = null;
    channel?.close();
    channel = null;
    state.setStatus("closed");
  }

  function becomeLeader(): void {
    callDiagnostic(options.diagnostics?.onCoordinationRoleChange, { role: "leader" });
    const leaderEngine = createLocalSSEClient(options, {
      ...dependencies,
      onStreamEvent: (event) => {
        channel?.post({ type: "event", event });
        void callSubscribers(event);
      }
    });
    engine = leaderEngine;

    engineSubscriptions.push(
      leaderEngine.subscribeStatus((status) => {
        state.setStatus(status);
        channel?.post({ type: "status", status });
      })
    );
    engineSubscriptions.push(
      leaderEngine.subscribeError((error) => {
        state.setError(error);
        channel?.post({ type: "error", error: serializeError(error) });
      })
    );

    void leaderEngine.connect();
  }

  function teardownEngine(): void {
    for (const unsubscribe of engineSubscriptions) {
      unsubscribe();
    }

    engineSubscriptions = [];
    engine?.disconnect();
    engine = null;
  }

  function handleMessage(message: CoordinationMessage): void {
    if (engine) {
      // We are the leader: answer snapshot requests from joining followers.
      if (message.type === "hello") {
        channel?.post({ type: "status", status: state.getStatus() });
        const error = state.getError();

        if (error) {
          channel?.post({ type: "error", error: serializeError(error) });
        }
      }

      return;
    }

    if (isActive) {
      applyRemoteMessage(message);
    }
  }

  function applyRemoteMessage(message: CoordinationMessage): void {
    if (message.type === "status") {
      state.setStatus(message.status);

      return;
    }

    if (message.type === "error") {
      state.setError(message.error);

      return;
    }

    if (message.type === "event") {
      void dispatchSSEEvent({ event: message.event, events: options.events }).then(
        (handlerError) => {
          if (handlerError) {
            state.setError(handlerError);
          }
        }
      );
      void callSubscribers(message.event);
    }
  }

  async function callSubscribers(event: ParsedSSEEvent): Promise<void> {
    const handlers = subscriberRegistry.get(event.event);
    const hasNamed = handlers !== undefined && handlers.size > 0;
    if (!hasNamed && anyEventHandlers.size === 0) return;

    const lenientPayload = parseEventPayload(event.data);

    for (const handler of anyEventHandlers) {
      try {
        await handler({ type: event.event, data: lenientPayload });
      } catch {
        // ignored
      }
    }

    if (!hasNamed) return;

    const parsed = parseEventPayloadStrict(event.data, event.event);

    if (!parsed.ok) {
      state.setError(parsed.error);
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(parsed.value);
      } catch (cause) {
        state.setError(normalizeError(cause, "handler"));
      }
    }
  }
}

function callDiagnostic<T>(callback: ((info: T) => void) | undefined, info: T): void {
  if (!callback) return;
  try {
    callback(info);
  } catch {
    // diagnostic errors must not affect the stream
  }
}

function serializeError(error: SSEError | null): SSEError | null {
  if (!error) {
    return null;
  }

  // Drop `cause`, which may not be structured-cloneable across a broadcast channel.
  return {
    kind: error.kind,
    message: error.message,
    status: error.status
  };
}
