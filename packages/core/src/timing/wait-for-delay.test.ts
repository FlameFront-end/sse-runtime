import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForDelay } from "./wait-for-delay";

describe("waitForDelay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the delay elapses", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();

    const promise = waitForDelay(50, controller.signal);
    vi.advanceTimersByTime(50);

    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("already aborted"));

    await expect(waitForDelay(50, controller.signal)).rejects.toThrow("already aborted");
  });

  it("rejects and clears the timer when aborted during the delay", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();

    const promise = waitForDelay(50, controller.signal);
    controller.abort(new Error("aborted mid-wait"));

    await expect(promise).rejects.toThrow("aborted mid-wait");
  });
});
