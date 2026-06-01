import { refreshAuth } from "../auth/refresh-auth";
import { createSSEClientState } from "../client/client-state";
import type { CoordinationBackend } from "../coordination/coordination-backend";
import {
  dispatchSSEEvent,
  parseEventPayload,
  parseEventPayloadStrict
} from "../events/dispatch-sse-event";
import { createHTTPError, createTransportError, normalizeError } from "../errors/sse-error";
import type { ParsedSSEEvent } from "../parser/parse-sse-chunk";
import { calculateReconnectDelay } from "../reconnect/calculate-reconnect-delay";
import {
  createFetchTransport,
  type FetchTransportOptions,
  type SSETransport
} from "../transport/create-fetch-transport";
import { readSSEStream } from "../transport/read-sse-stream";
import { waitForDelay } from "../timing/wait-for-delay";
import { combineSignals } from "../utils/combine-signals";
import type {
  EventHandler,
  EventMap,
  SSEAnyEventHandler,
  SSEClientOptions,
  SSEConnectionStatus,
  SSEError,
  SSEErrorListener,
  SSEStatusListener
} from "../types/public";
import { buildEnsureOpen } from "./build-ensure-open";

export type SSEClient<Events extends EventMap = EventMap> = {
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
  readonly ensureOpen: (options?: { readonly timeout?: number }) => Promise<boolean>;
  readonly getError: () => SSEError | null;
  readonly getStatus: () => SSEConnectionStatus;
  readonly subscribeError: (listener: SSEErrorListener) => () => void;
  readonly subscribeStatus: (listener: SSEStatusListener) => () => void;
  readonly subscribeEvent: <EventName extends keyof Events>(
    eventName: EventName,
    handler: EventHandler<Events[EventName]>
  ) => () => void;
  readonly subscribeAnyEvent: (handler: SSEAnyEventHandler) => () => void;
};

export type SSEClientDependencies = {
  readonly transport?: SSETransport;
  readonly createTextDecoder?: () => TextDecoder;
  readonly wait?: (delay: number, signal: AbortSignal) => Promise<void>;
  readonly coordinationBackend?: CoordinationBackend;
};

export type LocalSSEClientDependencies = SSEClientDependencies & {
  // Internal hook used by the coordination layer to forward raw stream events to
  // follower tabs. Not part of the public API.
  readonly onStreamEvent?: (event: ParsedSSEEvent) => Promise<void> | void;
  readonly initialLastEventId?: string;
};

type ConnectionStatus = "connecting" | "reconnecting";

export function createLocalSSEClient<Events extends EventMap>(
  options: SSEClientOptions<Events>,
  dependencies: LocalSSEClientDependencies = {}
): SSEClient<Events> {
  const state = createSSEClientState(options.enabled === false ? "idle" : "closed");
  const transport = dependencies.transport ?? createFetchTransport;
  const createTextDecoder = dependencies.createTextDecoder ?? (() => new TextDecoder());
  const wait = dependencies.wait ?? waitForDelay;
  const onStreamEvent = dependencies.onStreamEvent;

  type AnyHandler = (payload: unknown) => void | Promise<void>;
  const subscriberRegistry = new Map<string, Set<AnyHandler>>();
  const anyEventHandlers = new Set<SSEAnyEventHandler>();

  let abortController: AbortController | null = null;
  let connectPromise: Promise<void> | null = null;
  let hasManualDisconnect = false;
  let reconnectAttempt = 0;
  let authRefreshAttempt = 0;
  let generation = 0;
  let lastEventId: string | undefined = dependencies.initialLastEventId;
  let serverRetryDelay: number | undefined;

  const theClient: SSEClient<Events> = {
    async connect(): Promise<void> {
      if (state.getStatus() === "connecting" && connectPromise) {
        return connectPromise;
      }

      if (state.getStatus() === "open" || state.getStatus() === "reconnecting") {
        return;
      }

      hasManualDisconnect = false;
      reconnectAttempt = 0;
      authRefreshAttempt = 0;
      lastEventId = dependencies.initialLastEventId;
      serverRetryDelay = undefined;
      state.resetError();
      const currentConnectPromise = openConnection(createConnectionController(), "connecting");
      connectPromise = currentConnectPromise;

      try {
        await currentConnectPromise;
      } finally {
        if (connectPromise === currentConnectPromise) {
          connectPromise = null;
        }
      }
    },

    disconnect(): void {
      hasManualDisconnect = true;
      generation += 1;
      abortController?.abort();
      abortController = null;
      state.setStatus("closed");
      callDiagnostic(options.diagnostics?.onDisconnect, {
        url: options.url,
        reason: "manual"
      });
    },

    ensureOpen: buildEnsureOpen(state, () => void theClient.connect()),

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
    subscribeError: state.subscribeError,
    subscribeStatus: state.subscribeStatus
  };

  return theClient;

  function createConnectionController(): AbortController {
    const controller = new AbortController();
    abortController = controller;
    generation += 1;

    return controller;
  }

  async function openConnection(
    controller: AbortController,
    connectionStatus: ConnectionStatus
  ): Promise<void> {
    const currentGeneration = generation;

    let openTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
    let openTimeoutController: AbortController | null = null;

    if (options.openTimeout !== undefined) {
      openTimeoutController = new AbortController();
      openTimeoutTimer = setTimeout(() => {
        openTimeoutController!.abort(createTransportError("SSE connection open timed out"));
      }, options.openTimeout);
    }

    const effectiveSignal =
      openTimeoutController !== null
        ? combineSignals(controller.signal, openTimeoutController.signal)
        : controller.signal;

    try {
      state.setStatus(connectionStatus);
      callDiagnostic(options.diagnostics?.onAttempt, {
        attempt: reconnectAttempt,
        url: options.url
      });

      const transportOptions = await createTransportOptions(effectiveSignal);

      if (!isCurrentConnection(controller, currentGeneration)) {
        clearTimeout(openTimeoutTimer);
        return;
      }

      const response = await transport(transportOptions);

      clearTimeout(openTimeoutTimer);
      openTimeoutController = null;

      if (!response.ok) {
        throw createHTTPError(response);
      }

      if (!response.body) {
        throw createTransportError("SSE response body is empty");
      }

      if (!isCurrentConnection(controller, currentGeneration)) {
        return;
      }

      reconnectAttempt = 0;
      authRefreshAttempt = 0;
      state.resetError();
      state.setStatus("open");
      callDiagnostic(options.diagnostics?.onOpen, { url: options.url });
      startStreamReader(response.body, controller, currentGeneration);
    } catch (cause) {
      clearTimeout(openTimeoutTimer);
      handleConnectionError(cause, controller, currentGeneration, "connection");
    }
  }

  async function createTransportOptions(signal: AbortSignal): Promise<FetchTransportOptions> {
    const resolvedHeaders = await resolveHeaders();
    const headers =
      lastEventId === undefined
        ? resolvedHeaders
        : { ...resolvedHeaders, "Last-Event-ID": lastEventId };

    return {
      url: options.url,
      headers,
      credentials: options.credentials,
      signal
    };
  }

  async function resolveHeaders(): Promise<Record<string, string> | undefined> {
    if (!options.headers) {
      return undefined;
    }

    return typeof options.headers === "function" ? options.headers() : options.headers;
  }

  function startStreamReader(
    stream: ReadableStream<Uint8Array>,
    controller: AbortController,
    currentGeneration: number
  ): void {
    const streamTask = readSSEStream({
      stream,
      signal: controller.signal,
      createTextDecoder,
      onEvents: (events) => dispatchEvents(events),
      heartbeatTimeout: options.heartbeat?.timeout
    });

    streamTask
      .then((streamError) => {
        if (streamError) {
          handleConnectionError(streamError, controller, currentGeneration, "stream");
        }
      })
      .catch((cause: unknown) => {
        handleConnectionError(cause, controller, currentGeneration, "stream");
      });
  }

  async function dispatchEvents(events: readonly ParsedSSEEvent[]): Promise<void> {
    for (const event of events) {
      if (event.id !== undefined) {
        lastEventId = event.id;
      }

      if (event.retry !== undefined) {
        serverRetryDelay = event.retry;
      }

      callDiagnostic(options.diagnostics?.onRawEvent, {
        event: event.event,
        data: event.data,
        id: event.id,
        retry: event.retry,
        timestamp: Date.now(),
        connectionKey: options.key
      });

      await onStreamEvent?.(event);

      const handlerError = await dispatchSSEEvent({
        event,
        events: options.events
      });

      if (handlerError) {
        state.setError(handlerError);
      }

      await callSubscribers(event);
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

  type ErrorSource = "connection" | "stream";

  function handleConnectionError(
    cause: unknown,
    controller: AbortController,
    currentGeneration: number,
    source: ErrorSource
  ): void {
    if (!isCurrentConnection(controller, currentGeneration)) {
      return;
    }

    const connectionError = normalizeError(cause, "transport");
    state.setError(connectionError);

    if (connectionError.status === 401) {
      void refreshAuthAndReconnect(currentGeneration);
      return;
    }

    if (shouldRetry(connectionError)) {
      void reconnect(currentGeneration, connectionError);
      return;
    }

    callDiagnostic(options.diagnostics?.onDisconnect, {
      url: options.url,
      reason: source === "stream" ? "stream-ended" : "error"
    });
    state.setStatus("error");
  }

  function shouldRetry(error: SSEError): boolean {
    if (options.reconnect?.enabled === false) {
      return false;
    }

    const maxRetries = options.reconnect?.maxRetries ?? Infinity;
    if (reconnectAttempt >= maxRetries) {
      return false;
    }

    if (options.retry?.shouldRetry) {
      return options.retry.shouldRetry(error);
    }

    return true;
  }

  async function reconnect(currentGeneration: number, triggerError: SSEError): Promise<void> {
    if (!isExpectedGeneration(currentGeneration)) {
      return;
    }

    reconnectAttempt += 1;
    const controller = createConnectionController();

    state.setStatus("reconnecting");

    const delay =
      options.retry?.getDelay !== undefined
        ? options.retry.getDelay({
            attempt: reconnectAttempt,
            error: triggerError,
            serverRetry: serverRetryDelay
          })
        : calculateReconnectDelay(reconnectAttempt, options.reconnect, {
            serverRetry: serverRetryDelay
          });

    callDiagnostic(options.diagnostics?.onReconnectScheduled, {
      attempt: reconnectAttempt,
      delay,
      error: triggerError
    });

    try {
      await wait(delay, controller.signal);
    } catch {
      // The backoff wait was aborted by a manual disconnect or a newer connection.
      return;
    }

    if (!isCurrentConnection(controller, generation)) {
      return;
    }

    // openConnection handles its own failures (including scheduling the next reconnect),
    // so it never rejects here.
    await openConnection(controller, "reconnecting");
  }

  function callDiagnostic<T>(callback: ((info: T) => void) | undefined, info: T): void {
    if (!callback) return;
    try {
      callback(info);
    } catch {
      // diagnostic errors must not affect the stream
    }
  }

  async function refreshAuthAndReconnect(currentGeneration: number): Promise<void> {
    if (!isExpectedGeneration(currentGeneration)) {
      return;
    }

    if (authRefreshAttempt > 0) {
      state.setStatus("error");
      return;
    }

    authRefreshAttempt += 1;
    const controller = createConnectionController();
    state.setStatus("reconnecting");
    callDiagnostic(options.diagnostics?.onAuthRefresh, { error: state.getError()! });

    try {
      const shouldRetryAfterRefresh = await refreshAuth(options.auth ?? {});

      if (!shouldRetryAfterRefresh) {
        state.setStatus("error");
        return;
      }

      if (!isCurrentConnection(controller, generation)) {
        return;
      }

      await openConnection(controller, "reconnecting");
    } catch (cause) {
      if (!isCurrentConnection(controller, generation)) {
        return;
      }

      state.setError(normalizeError(cause, "auth"));
      state.setStatus("error");
    }
  }

  function isCurrentConnection(controller: AbortController, expectedGeneration: number): boolean {
    return (
      !hasManualDisconnect &&
      !controller.signal.aborted &&
      abortController === controller &&
      generation === expectedGeneration
    );
  }

  function isExpectedGeneration(expectedGeneration: number): boolean {
    return !hasManualDisconnect && generation === expectedGeneration;
  }
}
