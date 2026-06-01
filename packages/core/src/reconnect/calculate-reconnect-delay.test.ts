import { describe, expect, it } from "vitest";

import { calculateReconnectDelay } from "./calculate-reconnect-delay";

// random() === 1 collapses the jitter window onto the full exponential delay,
// which keeps the exponential/cap assertions deterministic.
const noJitter = (): number => 1;

describe("calculateReconnectDelay", () => {
  it("grows exponentially with each attempt", () => {
    const options = { minDelay: 1000, maxDelay: 30000 };

    expect(calculateReconnectDelay(1, options, { random: noJitter })).toBe(1000);
    expect(calculateReconnectDelay(2, options, { random: noJitter })).toBe(2000);
    expect(calculateReconnectDelay(3, options, { random: noJitter })).toBe(4000);
  });

  it("caps the delay at maxDelay", () => {
    const options = { minDelay: 1000, maxDelay: 5000 };

    expect(calculateReconnectDelay(10, options, { random: noJitter })).toBe(5000);
  });

  it("applies jitter within the lower half of the window", () => {
    const options = { minDelay: 1000, maxDelay: 30000 };

    expect(calculateReconnectDelay(1, options, { random: () => 0 })).toBe(500);
    expect(calculateReconnectDelay(1, options, { random: () => 1 })).toBe(1000);
  });

  it("uses the server-suggested retry as the base delay", () => {
    const options = { minDelay: 1000, maxDelay: 30000 };

    expect(calculateReconnectDelay(1, options, { serverRetry: 8000, random: noJitter })).toBe(8000);
  });

  it("falls back to defaults when no options are provided", () => {
    expect(calculateReconnectDelay(1, undefined, { random: noJitter })).toBe(1000);
  });
});
