import type { EventMap, SSEClientOptions } from "@flamefrontend/sse-runtime-core";
import type { MutableRefObject } from "react";

export function createReactClientOptions<Events extends EventMap>(
  options: SSEClientOptions<Events>,
  optionsRef: MutableRefObject<SSEClientOptions<Events>>
): SSEClientOptions<Events> {
  return {
    key: options.key,
    url: options.url,
    enabled: options.enabled,
    headers: () => {
      const headers = optionsRef.current.headers;

      return typeof headers === "function" ? headers() : (headers ?? {});
    },
    credentials: options.credentials,
    events: createEventHandlers(optionsRef),
    reconnect: createReconnectOptions(optionsRef),
    auth: createAuthOptions(optionsRef),
    coordination: options.coordination,
    heartbeat: options.heartbeat,
    diagnostics: createDiagnosticsOptions(optionsRef),
    retry: createRetryOptions(optionsRef),
    openTimeout: options.openTimeout
  };
}

function createEventHandlers<Events extends EventMap>(
  optionsRef: MutableRefObject<SSEClientOptions<Events>>
): SSEClientOptions<Events>["events"] {
  const eventHandlers: Partial<{
    [EventName in keyof Events]: (payload: Events[EventName]) => void | Promise<void>;
  }> = {};
  const eventNames = Object.keys(optionsRef.current.events ?? {}) as Array<keyof Events>;

  for (const eventName of eventNames) {
    eventHandlers[eventName] = (payload: Events[typeof eventName]) => {
      const handler = optionsRef.current.events?.[eventName];

      return handler?.(payload);
    };
  }

  return eventHandlers as SSEClientOptions<Events>["events"];
}

function createReconnectOptions<Events extends EventMap>(
  optionsRef: MutableRefObject<SSEClientOptions<Events>>
): SSEClientOptions<Events>["reconnect"] {
  return {
    get enabled() {
      return optionsRef.current.reconnect?.enabled;
    },
    get maxRetries() {
      return optionsRef.current.reconnect?.maxRetries;
    },
    get minDelay() {
      return optionsRef.current.reconnect?.minDelay;
    },
    get maxDelay() {
      return optionsRef.current.reconnect?.maxDelay;
    }
  };
}

function createAuthOptions<Events extends EventMap>(
  optionsRef: MutableRefObject<SSEClientOptions<Events>>
): SSEClientOptions<Events>["auth"] {
  return {
    get onUnauthorized() {
      return optionsRef.current.auth?.onUnauthorized;
    },
    get retryAfterRefresh() {
      return optionsRef.current.auth?.retryAfterRefresh;
    }
  };
}

function createDiagnosticsOptions<Events extends EventMap>(
  optionsRef: MutableRefObject<SSEClientOptions<Events>>
): SSEClientOptions<Events>["diagnostics"] {
  if (optionsRef.current.diagnostics == null) {
    return undefined;
  }

  return {
    get onAttempt() {
      return optionsRef.current.diagnostics?.onAttempt;
    },
    get onReconnectScheduled() {
      return optionsRef.current.diagnostics?.onReconnectScheduled;
    },
    get onAuthRefresh() {
      return optionsRef.current.diagnostics?.onAuthRefresh;
    },
    get onCoordinationRoleChange() {
      return optionsRef.current.diagnostics?.onCoordinationRoleChange;
    },
    get onRawEvent() {
      return optionsRef.current.diagnostics?.onRawEvent;
    },
    get onOpen() {
      return optionsRef.current.diagnostics?.onOpen;
    },
    get onDisconnect() {
      return optionsRef.current.diagnostics?.onDisconnect;
    },
    get onParseError() {
      return optionsRef.current.diagnostics?.onParseError;
    }
  };
}

function createRetryOptions<Events extends EventMap>(
  optionsRef: MutableRefObject<SSEClientOptions<Events>>
): SSEClientOptions<Events>["retry"] {
  return {
    get shouldRetry() {
      return optionsRef.current.retry?.shouldRetry;
    },
    get getDelay() {
      return optionsRef.current.retry?.getDelay;
    }
  };
}
