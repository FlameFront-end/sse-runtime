// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { attachLifecycleResume } from "./attach-lifecycle-resume";
import type { SSEClient } from "../client/create-local-sse-client";
import type { SSEConnectionStatus } from "../types/public";

function createFakeClient(
  overrides: {
    readonly getStatus?: () => SSEConnectionStatus;
    readonly getLastEventAt?: () => number | undefined;
  } = {}
): SSEClient {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    reconnect: vi.fn(async () => undefined),
    ensureOpen: vi.fn(async () => true),
    getError: () => null,
    getStatus: overrides.getStatus ?? (() => "open"),
    getLastEventAt: overrides.getLastEventAt ?? (() => undefined),
    subscribeError: () => () => undefined,
    subscribeStatus: () => () => undefined,
    subscribeEvent: () => () => undefined,
    subscribeAnyEvent: () => () => undefined
  };
}

describe("attachLifecycleResume", () => {
  it("calls ensureOpen on focus by default", () => {
    const client = createFakeClient();
    const detach = attachLifecycleResume(client);

    window.dispatchEvent(new Event("focus"));

    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    expect(client.reconnect).not.toHaveBeenCalled();
    detach();
  });

  it("forces reconnect with the reconnect strategy", () => {
    const client = createFakeClient();
    const detach = attachLifecycleResume(client, { strategy: "reconnect" });

    window.dispatchEvent(new Event("online"));

    expect(client.reconnect).toHaveBeenCalledTimes(1);
    expect(client.ensureOpen).not.toHaveBeenCalled();
    detach();
  });

  it("resumes when the document becomes visible", () => {
    const client = createFakeClient();
    const detach = attachLifecycleResume(client, { triggers: ["visible"] });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    detach();
  });

  it("throttles bursts of lifecycle signals", () => {
    const client = createFakeClient();
    const detach = attachLifecycleResume(client, { throttleMs: 10_000 });

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));

    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    detach();
  });

  it("only registers the requested triggers", () => {
    const client = createFakeClient();
    const detach = attachLifecycleResume(client, { triggers: ["online"] });

    window.dispatchEvent(new Event("focus"));
    expect(client.ensureOpen).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("online"));
    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    detach();
  });

  it("removes listeners on cleanup", () => {
    const client = createFakeClient();
    const detach = attachLifecycleResume(client);

    detach();
    window.dispatchEvent(new Event("focus"));

    expect(client.ensureOpen).not.toHaveBeenCalled();
  });

  it("skips an unforced trigger while the connection is fresh and open", () => {
    const client = createFakeClient({ getStatus: () => "open", getLastEventAt: () => Date.now() });
    const detach = attachLifecycleResume(client, { staleTimeoutMs: 60_000 });

    window.dispatchEvent(new Event("focus"));

    expect(client.ensureOpen).not.toHaveBeenCalled();
    detach();
  });

  it("resumes an unforced trigger when the connection is stale", () => {
    const client = createFakeClient({
      getStatus: () => "open",
      getLastEventAt: () => Date.now() - 120_000
    });
    const detach = attachLifecycleResume(client, { staleTimeoutMs: 60_000 });

    window.dispatchEvent(new Event("focus"));

    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    detach();
  });

  it("resumes an unforced trigger when the connection is not open", () => {
    const client = createFakeClient({ getStatus: () => "error", getLastEventAt: () => Date.now() });
    const detach = attachLifecycleResume(client, { staleTimeoutMs: 60_000 });

    window.dispatchEvent(new Event("focus"));

    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    detach();
  });

  it("forces a resume on a wake signal even when the connection looks fresh", () => {
    const client = createFakeClient({ getStatus: () => "open", getLastEventAt: () => Date.now() });
    const detach = attachLifecycleResume(client, { staleTimeoutMs: 60_000 });

    window.dispatchEvent(new Event("online"));

    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    detach();
  });

  it("skips the visible resume when the tab was hidden only briefly", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const client = createFakeClient();
    const detach = attachLifecycleResume(client, { triggers: ["visible"], minHiddenMs: 10_000 });

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    nowSpy.mockReturnValue(1_000 + 2_000);
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(client.ensureOpen).not.toHaveBeenCalled();
    detach();
    nowSpy.mockRestore();
  });

  it("resumes the visible trigger once the tab was hidden long enough", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const client = createFakeClient();
    const detach = attachLifecycleResume(client, { triggers: ["visible"], minHiddenMs: 10_000 });

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    nowSpy.mockReturnValue(1_000 + 20_000);
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    detach();
    nowSpy.mockRestore();
  });

  it("forces a resume when the watchdog detects wake drift", () => {
    vi.useFakeTimers();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);
    const client = createFakeClient();
    const detach = attachLifecycleResume(client, { wakeDriftMs: 60_000 });

    nowSpy.mockReturnValue(30_000 + 300_000);
    vi.advanceTimersByTime(30_000);

    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    detach();
    nowSpy.mockRestore();
    vi.useRealTimers();
  });

  it("reconnects a silently stalled stream via the watchdog", () => {
    vi.useFakeTimers();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(0);
    const client = createFakeClient({ getStatus: () => "open", getLastEventAt: () => 1 });
    const detach = attachLifecycleResume(client, { staleTimeoutMs: 60_000 });

    nowSpy.mockReturnValue(120_000);
    vi.advanceTimersByTime(30_000);

    expect(client.ensureOpen).toHaveBeenCalledTimes(1);
    detach();
    nowSpy.mockRestore();
    vi.useRealTimers();
  });
});

function setVisibility(value: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value
  });
}
