import type { ReconnectOptions } from "../types/public";

const DEFAULT_MIN_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;

export type ReconnectDelayContext = {
  readonly serverRetry?: number;
  readonly random?: () => number;
};

export function calculateReconnectDelay(
  attempt: number,
  options: ReconnectOptions = {},
  context: ReconnectDelayContext = {}
): number {
  const random = context.random ?? Math.random;
  const baseDelay = context.serverRetry ?? options.minDelay ?? DEFAULT_MIN_DELAY;
  const maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;
  const exponentialDelay = Math.min(baseDelay * 2 ** Math.max(0, attempt - 1), maxDelay);
  const jitteredDelay = exponentialDelay / 2 + random() * (exponentialDelay / 2);

  return Math.min(jitteredDelay, maxDelay);
}
