export type ReconnectOptions = {
  readonly enabled?: boolean;
  readonly maxRetries?: number;
  readonly minDelay?: number;
  readonly maxDelay?: number;
};
