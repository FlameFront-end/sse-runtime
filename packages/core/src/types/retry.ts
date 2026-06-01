import type { SSEError } from "./errors";

export type RetryContext = {
  readonly attempt: number;
  readonly error: SSEError;
  readonly serverRetry: number | undefined;
};

export type RetryPolicyOptions = {
  readonly shouldRetry?: (error: SSEError) => boolean;
  readonly getDelay?: (context: RetryContext) => number;
};
