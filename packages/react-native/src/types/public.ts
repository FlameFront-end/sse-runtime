import type {
  CoordinationRole,
  EventMap,
  SSEClient,
  SSEConnectionStatus,
  SSEError
} from "@flamefrontend/sse-runtime-core";

export type UseReactNativeSSEResult<Events extends EventMap = EventMap> = {
  readonly status: SSEConnectionStatus;
  readonly error: SSEError | null;
  readonly role: CoordinationRole | null;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
  readonly reconnect: () => Promise<void>;
  readonly ensureOpen: (options?: { readonly timeout?: number }) => Promise<boolean>;
  readonly client: SSEClient<Events>;
};
