// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { attachLifecycleResume } from "./attach-lifecycle-resume";
import type { SSEClient } from "../client/create-local-sse-client";

function createFakeClient(): SSEClient {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    reconnect: vi.fn(async () => undefined),
    ensureOpen: vi.fn(async () => true),
    getError: () => null,
    getStatus: () => "open",
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
});
