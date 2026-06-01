import type { SSEConnectionStatus, SSEError } from "@flamefrontend/sse-runtime-core";

export type UseSSEResult = {
  readonly status: SSEConnectionStatus;
  readonly error: SSEError | null;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
};

export type UseSSEStatusResult = {
  readonly status: SSEConnectionStatus;
  readonly error: SSEError | null;
};
