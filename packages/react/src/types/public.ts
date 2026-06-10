import type {
  CoordinationRole,
  EnsureHealthyOptions,
  EventMap,
  ReconnectRequestOptions,
  SSEClient,
  SSEConnectionStatus,
  SSEError
} from "@flamefrontend/sse-runtime-core";

export type UseSSEResult<Events extends EventMap = EventMap> = {
  readonly status: SSEConnectionStatus;
  readonly error: SSEError | null;
  readonly role: CoordinationRole | null;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
  readonly reconnect: (options?: ReconnectRequestOptions) => Promise<void>;
  readonly ensureOpen: (options?: { readonly timeout?: number }) => Promise<boolean>;
  readonly ensureHealthy: (options: EnsureHealthyOptions) => Promise<boolean>;
  readonly client: SSEClient<Events>;
};

export type UseSSEStatusResult = {
  readonly status: SSEConnectionStatus;
  readonly error: SSEError | null;
};
