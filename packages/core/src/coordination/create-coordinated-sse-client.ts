import { createSSEClientState } from "../client/client-state";
import { createLocalSSEClient } from "../client/create-local-sse-client";
import type { SSEClient, SSEClientDependencies } from "../client/create-local-sse-client";
import { buildEnsureOpen } from "../client/build-ensure-open";
import {
  dispatchSSEEvent,
  parseEventPayload,
  parseEventPayloadStrict
} from "../events/dispatch-sse-event";
import { normalizeError } from "../errors/sse-error";
import type { ParsedSSEEvent } from "../parser/parse-sse-chunk";
import type {
  CoordinationRole,
  DisconnectDiagnosticInfo,
  EventHandler,
  EventMap,
  EnsureHealthyOptions,
  ReconnectRequestOptions,
  SSEActivityListener,
  SSEAnyEventHandler,
  SSEClientOptions,
  SSEError,
  SSERecoveryEvent,
  SSERecoveryListener
} from "../types/public";
import type { CoordinationBackend, CoordinationChannel } from "./coordination-backend";
import type { CoordinationDiagnostic, CoordinationMessage } from "./coordination-message";
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
  let followerChain: Promise<void> = Promise.resolve();
  let followerGeneration = 0;
  let reconnectRequestCounter = 0;
  let reconnectPromise: Promise<void> | null = null;
  let lastEventId: string | undefined;
  let lastActivityAt: number | undefined;
  let lastEventAt: number | undefined;
  let lastRecovery: SSERecoveryEvent | undefined;
  let role: CoordinationRole | null = null;
  const roleListeners = new Set<(role: CoordinationRole | null) => void>();
  const activityListeners = new Set<SSEActivityListener>();
  const recoveryListeners = new Set<SSERecoveryListener>();
  const reconnectResolvers = new Map<
    string,
    { readonly resolve: () => void; readonly reject: (error: Error) => void }
  >();

  function setRole(next: CoordinationRole | null): void {
    if (role === next) {
      return;
    }
    role = next;
    for (const listener of roleListeners) {
      try {
        listener(role);
      } catch {
        // role listener errors must not affect coordination
      }
    }
  }

  return {
    connect,
    disconnect,
    reconnect,

    ensureOpen: buildEnsureOpen(state, () => void connect()),
    async ensureHealthy(healthOptions: EnsureHealthyOptions): Promise<boolean> {
      const activityAt = lastActivityAt;
      const isFresh =
        state.getStatus() === "open" &&
        activityAt !== undefined &&
        Date.now() - activityAt <= healthOptions.staleAfter;

      if (isFresh) {
        return true;
      }

      await reconnect({
        reason: healthOptions.reason ?? "health-check",
        timeout: healthOptions.timeout
      });

      return buildEnsureOpen(state, () => void connect())({ timeout: healthOptions.timeout });
    },

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
        const set = subscriberRegistry.get(key);
        if (set) {
          set.delete(anyHandler);
          if (set.size === 0) subscriberRegistry.delete(key);
        }
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
    getLastActivityAt: () => lastActivityAt,
    getLastEventAt: () => lastEventAt,
    getLastRecovery: () => lastRecovery,
    getRole: () => role,
    subscribeRole(listener: (role: CoordinationRole | null) => void): () => void {
      roleListeners.add(listener);
      listener(role);
      return () => {
        roleListeners.delete(listener);
      };
    },
    subscribeActivity(listener: SSEActivityListener): () => void {
      activityListeners.add(listener);
      if (lastActivityAt !== undefined) {
        listener(lastActivityAt);
      }
      return () => {
        activityListeners.delete(listener);
      };
    },
    subscribeError: state.subscribeError,
    subscribeRecovery(listener: SSERecoveryListener): () => void {
      recoveryListeners.add(listener);
      if (lastRecovery !== undefined) {
        listener(lastRecovery);
      }
      return () => {
        recoveryListeners.delete(listener);
      };
    },
    subscribeStatus: state.subscribeStatus
  };

  async function connect(): Promise<void> {
    if (isActive) {
      return;
    }

    isActive = true;
    followerGeneration += 1;
    followerChain = Promise.resolve();
    channel = backend.createChannel(channelName);
    unsubscribeChannel = channel.subscribe(handleMessage);

    // Ask the current leader (if any) for a status snapshot while we wait.
    channel.post({ type: "hello" });

    const controller = new AbortController();
    leadershipController = controller;
    setRole("follower");
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

  async function reconnect(reconnectOptions?: ReconnectRequestOptions): Promise<void> {
    if (reconnectPromise) {
      return reconnectPromise;
    }

    const reason = reconnectOptions?.reason ?? "manual";
    if (!engine) {
      emitRecovery({ phase: "requested", reason, timestamp: Date.now() });
    }
    reconnectPromise = engine
      ? reconnectLeader(reason)
      : requestLeaderReconnect(reason, reconnectOptions?.timeout);

    try {
      await reconnectPromise;
    } finally {
      reconnectPromise = null;
    }
  }

  function disconnect(): void {
    isActive = false;
    followerGeneration += 1;
    setRole(null);
    teardownEngine();
    leadershipController?.abort();
    leadershipController = null;
    unsubscribeChannel?.();
    unsubscribeChannel = null;
    channel?.close();
    channel = null;
    for (const resolver of reconnectResolvers.values()) {
      resolver.reject(new Error("SSE reconnect request cancelled"));
    }
    reconnectResolvers.clear();
    state.setStatus("closed");
    callDiagnostic(options.diagnostics?.onDisconnect, {
      url: options.url,
      reason: "manual"
    });
  }

  function buildLeaderDiagnostics(): SSEClientOptions<Events>["diagnostics"] {
    const consumer = options.diagnostics;

    return {
      onAttempt: consumer?.onAttempt,
      onReconnectScheduled: consumer?.onReconnectScheduled,
      onAuthRefresh: consumer?.onAuthRefresh,
      onCoordinationRoleChange: consumer?.onCoordinationRoleChange,
      onParseError: consumer?.onParseError,
      onRawEvent: (info) => {
        callDiagnostic(consumer?.onRawEvent, { ...info, role: "leader" });
        channel?.post({ type: "diagnostic", diagnostic: { kind: "rawEvent", info } });
      },
      onOpen: (info) => {
        callDiagnostic(consumer?.onOpen, info);
        channel?.post({ type: "diagnostic", diagnostic: { kind: "open", info } });
      },
      onDisconnect: (info: DisconnectDiagnosticInfo) => {
        if (info.reason !== "manual") {
          callDiagnostic(consumer?.onDisconnect, info);
        }
        channel?.post({ type: "diagnostic", diagnostic: { kind: "disconnect", info } });
      }
    };
  }

  function becomeLeader(): void {
    setRole("leader");
    callDiagnostic(options.diagnostics?.onCoordinationRoleChange, { role: "leader" });
    const leaderEngine = createLocalSSEClient(
      { ...options, diagnostics: buildLeaderDiagnostics() },
      {
        ...dependencies,
        initialLastEventId: lastEventId,
        onStreamEvent: async (event) => {
          if (event.id !== undefined) {
            lastEventId = event.id;
          }

          channel?.post({ type: "event", event });
          await callSubscribers(event);
        }
      }
    );
    engine = leaderEngine;

    let forwardStatus = false;
    engineSubscriptions.push(
      leaderEngine.subscribeStatus((status) => {
        if (!forwardStatus) {
          return;
        }

        state.setStatus(status);
        channel?.post({ type: "status", status });
      })
    );
    forwardStatus = true;

    engineSubscriptions.push(
      leaderEngine.subscribeError((error) => {
        state.setError(error);
        channel?.post({ type: "error", error: serializeError(error) });
      })
    );
    engineSubscriptions.push(
      leaderEngine.subscribeActivity((timestamp) => {
        emitActivity(timestamp);
        channel?.post({ type: "activity", timestamp });
      })
    );
    engineSubscriptions.push(
      leaderEngine.subscribeRecovery((event) => {
        emitRecovery(event);
        channel?.post({ type: "recovery", event });
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
        if (lastActivityAt !== undefined) {
          channel?.post({ type: "activity", timestamp: lastActivityAt });
        }
        const error = state.getError();

        if (error) {
          channel?.post({ type: "error", error: serializeError(error) });
        }
      }

      if (message.type === "reconnect-request") {
        void reconnect({ reason: message.reason }).then(
          () => channel?.post({ type: "reconnect-result", requestId: message.requestId, ok: true }),
          () => channel?.post({ type: "reconnect-result", requestId: message.requestId, ok: false })
        );
      }

      return;
    }

    if (isActive) {
      applyRemoteMessage(message);
    }
  }

  function applyRemoteMessage(message: CoordinationMessage): void {
    if (message.type === "status") {
      enqueueFollowerTask(() => state.setStatus(message.status));

      return;
    }

    if (message.type === "error") {
      enqueueFollowerTask(() => state.setError(message.error));

      return;
    }

    if (message.type === "activity") {
      enqueueFollowerTask(() => emitActivity(message.timestamp));

      return;
    }

    if (message.type === "recovery") {
      enqueueFollowerTask(() => emitRecovery(message.event));

      return;
    }

    if (message.type === "reconnect-result") {
      const resolver = reconnectResolvers.get(message.requestId);
      if (!resolver) {
        return;
      }
      if (message.ok) {
        resolver.resolve();
      } else {
        resolver.reject(new Error("SSE leader reconnect failed"));
      }

      return;
    }

    if (message.type === "diagnostic") {
      const diagnostic = message.diagnostic;
      enqueueFollowerTask(() => applyRemoteDiagnostic(diagnostic));

      return;
    }

    if (message.type === "event") {
      const event = message.event;

      if (event.id !== undefined) {
        lastEventId = event.id;
      }

      enqueueFollowerTask(async () => {
        const handlerError = await dispatchSSEEvent({ event, events: options.events });

        if (handlerError) {
          state.setError(handlerError);
        }

        await callSubscribers(event);
      });
    }
  }

  function applyRemoteDiagnostic(diagnostic: CoordinationDiagnostic): void {
    if (diagnostic.kind === "rawEvent") {
      callDiagnostic(options.diagnostics?.onRawEvent, { ...diagnostic.info, role: "follower" });

      return;
    }

    if (diagnostic.kind === "open") {
      callDiagnostic(options.diagnostics?.onOpen, diagnostic.info);

      return;
    }

    callDiagnostic(options.diagnostics?.onDisconnect, diagnostic.info);
  }

  function enqueueFollowerTask(task: () => Promise<void> | void): void {
    const taskGeneration = followerGeneration;

    followerChain = followerChain
      .then(() => {
        if (!isActive || taskGeneration !== followerGeneration) {
          return undefined;
        }

        return task();
      })
      .catch(() => undefined);
  }

  async function callSubscribers(event: ParsedSSEEvent): Promise<void> {
    lastEventAt = Date.now();

    const handlers = subscriberRegistry.get(event.event);
    const hasNamed = handlers !== undefined && handlers.size > 0;
    if (!hasNamed && anyEventHandlers.size === 0) return;

    const lenientPayload = parseEventPayload(event.data);

    for (const handler of anyEventHandlers) {
      try {
        await handler({ type: event.event, data: lenientPayload, raw: event.data });
      } catch {
        // ignored
      }
    }

    if (!hasNamed) return;

    const parsed = parseEventPayloadStrict(event.data, event.event);

    if (!parsed.ok) {
      callDiagnostic(options.diagnostics?.onParseError, {
        error: parsed.error,
        eventName: event.event
      });
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

  async function reconnectLeader(reason: string): Promise<void> {
    if (!engine) {
      throw new Error("SSE coordination leader is not available");
    }

    await engine.reconnect({ reason });
  }

  async function requestLeaderReconnect(reason: string, timeout?: number): Promise<void> {
    if (!isActive) {
      await connect();
    }

    if (!channel) {
      throw new Error("SSE coordination channel is not available");
    }

    const activeChannel = channel;
    const requestId = `${Date.now()}-${(reconnectRequestCounter += 1)}`;

    return new Promise<void>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const settle = (callback: () => void): void => {
        if (!reconnectResolvers.delete(requestId)) {
          return;
        }
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        callback();
      };

      reconnectResolvers.set(requestId, {
        resolve: () => settle(resolve),
        reject: (error) => settle(() => reject(error))
      });

      if (timeout !== undefined) {
        timeoutId = setTimeout(() => {
          const resolver = reconnectResolvers.get(requestId);
          resolver?.reject(new Error(`SSE reconnect request timed out after ${timeout}ms`));
        }, timeout);
      }

      activeChannel.post({ type: "reconnect-request", requestId, reason });
    });
  }

  function emitActivity(timestamp: number): void {
    lastActivityAt = timestamp;
    for (const listener of activityListeners) {
      try {
        listener(timestamp);
      } catch {
        // activity listener errors must not affect coordination
      }
    }
  }

  function emitRecovery(event: SSERecoveryEvent): void {
    lastRecovery = event;
    for (const listener of recoveryListeners) {
      try {
        listener(event);
      } catch {
        // recovery listener errors must not affect coordination
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
