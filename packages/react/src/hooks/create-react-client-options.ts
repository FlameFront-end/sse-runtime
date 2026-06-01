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
    coordination: options.coordination
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
