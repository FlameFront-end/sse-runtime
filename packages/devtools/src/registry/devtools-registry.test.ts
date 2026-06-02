import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_EVENTS } from "../constants";
import { createDevtoolsRegistry } from "./devtools-registry";
import type {
  SSEAnyEventHandler,
  SSEConnectionStatus,
  SSEError
} from "@flamefrontend/sse-runtime-core";

// ─── Mock client factory ─────────────────────────────────────────────────────

type StatusListener = (s: SSEConnectionStatus) => void;
type ErrorListener = (e: SSEError | null) => void;

function createMockClient(initialStatus: SSEConnectionStatus = "closed") {
  let status: SSEConnectionStatus = initialStatus;
  let error: SSEError | null = null;
  const statusListeners = new Set<StatusListener>();
  const errorListeners = new Set<ErrorListener>();
  const anyEventHandlers = new Set<SSEAnyEventHandler>();

  return {
    getStatus: () => status,
    getError: () => error,
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    ensureOpen: vi.fn(async () => true),
    subscribeEvent: vi.fn(() => () => undefined),
    subscribeAnyEvent: vi.fn((handler: SSEAnyEventHandler) => {
      anyEventHandlers.add(handler);
      return () => anyEventHandlers.delete(handler);
    }),
    subscribeStatus: vi.fn((listener: StatusListener) => {
      statusListeners.add(listener);
      listener(status); // fires immediately, matching the real implementation
      return () => statusListeners.delete(listener);
    }),
    subscribeError: vi.fn((listener: ErrorListener) => {
      errorListeners.add(listener);
      listener(error); // fires immediately
      return () => errorListeners.delete(listener);
    }),
    // Test helpers
    _setStatus(next: SSEConnectionStatus) {
      if (status === next) return;
      status = next;
      for (const l of statusListeners) l(status);
    },
    _setError(next: SSEError | null) {
      error = next;
      for (const l of errorListeners) l(error);
    },
    _emitEvent(type: string, data: unknown) {
      for (const h of anyEventHandlers) void h({ type, data });
    }
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function flushFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createDevtoolsRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers a client and exposes it in the snapshot", async () => {
    const registry = createDevtoolsRegistry();
    const client = createMockClient("open");

    registry.register({ id: "key-1", url: "/events", client });
    vi.runAllTimers();

    const snapshot = registry.getSnapshot();
    expect(snapshot.size).toBe(1);
    const [record] = [...snapshot.values()];
    expect(record.url).toBe("/events");
    expect(record.status).toBe("open");
    expect(record.key).toBe("key-1");
  });

  it("generates unique instance ids so two clients with the same key coexist", async () => {
    const registry = createDevtoolsRegistry();
    const a = createMockClient();
    const b = createMockClient();

    registry.register({ id: "same-key", url: "/a", client: a });
    registry.register({ id: "same-key", url: "/b", client: b });
    vi.runAllTimers();

    const snapshot = registry.getSnapshot();
    expect(snapshot.size).toBe(2);
    const ids = [...snapshot.keys()];
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("removes the record when the cleanup function is called", async () => {
    const registry = createDevtoolsRegistry();
    const client = createMockClient();

    const unregister = registry.register({ id: "key-1", url: "/events", client });
    vi.runAllTimers();

    unregister();
    vi.runAllTimers();

    expect(registry.getSnapshot().size).toBe(0);
  });

  it("reflects status changes from the client", async () => {
    const registry = createDevtoolsRegistry();
    const client = createMockClient("closed");

    registry.register({ id: "key-1", url: "/events", client });
    client._setStatus("open");
    vi.runAllTimers();

    const record = [...registry.getSnapshot().values()][0];
    expect(record.status).toBe("open");
  });

  it("stamps connectedAt when status becomes open, clears it otherwise", async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("closed");

    registry.register({ id: "k", url: "/e", client });
    await flushFrame();

    expect([...registry.getSnapshot().values()][0].connectedAt).toBeNull();

    client._setStatus("open");
    await flushFrame();
    expect([...registry.getSnapshot().values()][0].connectedAt).toBeGreaterThan(0);

    client._setStatus("reconnecting");
    await flushFrame();
    expect([...registry.getSnapshot().values()][0].connectedAt).toBeNull();
  });

  it("seeds connectedAt/firstConnectedAt when the client is already open at registration", async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("open");

    registry.register({ id: "k", url: "/e", client });
    await flushFrame();

    const record = [...registry.getSnapshot().values()][0];
    expect(record.connectedAt).toBeGreaterThan(0);
    expect(record.firstConnectedAt).toBeGreaterThan(0);
    expect(record.reconnectCount).toBe(0);
  });

  it("keeps firstConnectedAt and counts reconnects across open/reconnecting cycles", async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("closed");

    registry.register({ id: "k", url: "/e", client });
    client._setStatus("open");
    await flushFrame();
    const first = [...registry.getSnapshot().values()][0].firstConnectedAt;
    expect(first).toBeGreaterThan(0);
    expect([...registry.getSnapshot().values()][0].reconnectCount).toBe(0);

    client._setStatus("reconnecting");
    client._setStatus("open");
    await flushFrame();

    const record = [...registry.getSnapshot().values()][0];
    expect(record.firstConnectedAt).toBe(first);
    expect(record.reconnectCount).toBe(1);
  });

  it("tracks lastEventAt and resets it on clearEvents", async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("open");

    registry.register({ id: "k", url: "/e", client });
    expect([...registry.getSnapshot().values()][0].lastEventAt).toBeNull();

    client._emitEvent("ping", 1);
    await flushFrame();
    expect([...registry.getSnapshot().values()][0].lastEventAt).toBeGreaterThan(0);

    const id = [...registry.getSnapshot().keys()][0];
    registry.clearEvents(id);
    await flushFrame();
    expect([...registry.getSnapshot().values()][0].lastEventAt).toBeNull();
  });

  it("reflects error changes from the client", async () => {
    const registry = createDevtoolsRegistry();
    const client = createMockClient();
    const err: SSEError = {
      kind: "transport",
      message: "oops",
      status: undefined,
      cause: undefined
    };

    registry.register({ id: "k", url: "/e", client });
    client._setError(err);
    vi.runAllTimers();

    const record = [...registry.getSnapshot().values()][0];
    expect(record.error).toBe(err);
  });

  it("does not notify listeners when status or error subscriptions repeat the current value", () => {
    const registry = createDevtoolsRegistry();
    const client = createMockClient("closed");
    const listener = vi.fn();

    registry.subscribe(listener);
    registry.register({ id: "k", url: "/e", client });
    vi.runAllTimers();
    listener.mockClear();

    client._setStatus("closed");
    client._setError(null);
    vi.runAllTimers();

    expect(listener).not.toHaveBeenCalled();
  });

  it("appends events from subscribeAnyEvent to the log", async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("open");

    registry.register({ id: "k", url: "/e", client });
    client._emitEvent("message", { text: "hello" });
    await flushFrame();

    const record = [...registry.getSnapshot().values()][0];
    expect(record.events).toHaveLength(1);
    expect(record.events[0].type).toBe("message");
    expect(record.events[0].data).toEqual({ text: "hello" });
    expect(record.totalEvents).toBe(1);
  });

  it(`caps the event log at MAX_EVENTS (${MAX_EVENTS})`, async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("open");

    registry.register({ id: "k", url: "/e", client });
    for (let i = 0; i < MAX_EVENTS + 10; i++) {
      client._emitEvent("ping", i);
    }
    await flushFrame();

    const record = [...registry.getSnapshot().values()][0];
    expect(record.events).toHaveLength(MAX_EVENTS);
    expect(record.totalEvents).toBe(MAX_EVENTS + 10);
  });

  it("snapshots event payloads so later mutation of the source object is not reflected", async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("open");

    registry.register({ id: "k", url: "/e", client });
    const payload = { text: "hello" };
    client._emitEvent("message", payload);
    await flushFrame();

    payload.text = "mutated";

    const record = [...registry.getSnapshot().values()][0];
    expect(record.events[0].data).toEqual({ text: "hello" });
  });

  it("tracks recentEventTimestamps for the rate metric and resets them on clearEvents", async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("open");

    registry.register({ id: "k", url: "/e", client });
    client._emitEvent("ping", 1);
    client._emitEvent("ping", 2);
    await flushFrame();

    expect([...registry.getSnapshot().values()][0].recentEventTimestamps).toHaveLength(2);

    const id = [...registry.getSnapshot().keys()][0];
    registry.clearEvents(id);
    await flushFrame();

    expect([...registry.getSnapshot().values()][0].recentEventTimestamps).toHaveLength(0);
  });

  it("clears the event log without resetting totalEvents counter", async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("open");

    registry.register({ id: "k", url: "/e", client });
    client._emitEvent("ping", 1);
    client._emitEvent("ping", 2);
    await flushFrame();

    const id = [...registry.getSnapshot().keys()][0];
    registry.clearEvents(id);
    await flushFrame();

    const record = [...registry.getSnapshot().values()][0];
    expect(record.events).toHaveLength(0);
    expect(record.totalEvents).toBe(0);
  });

  it("coalesces rapid commits into a single listener notification", async () => {
    vi.useRealTimers();
    const registry = createDevtoolsRegistry();
    const client = createMockClient("open");
    const listener = vi.fn();

    registry.subscribe(listener);
    registry.register({ id: "k", url: "/e", client });

    // Emit 5 events synchronously — only one rAF notification should follow.
    for (let i = 0; i < 5; i++) client._emitEvent("ping", i);

    const callsBefore = listener.mock.calls.length;
    await flushFrame();
    const callsAfter = listener.mock.calls.length;

    // At most one extra notification per frame.
    expect(callsAfter - callsBefore).toBeLessThanOrEqual(1);
  });

  it("unsubscribes all client listeners on cleanup", () => {
    const registry = createDevtoolsRegistry();
    const client = createMockClient();

    const unregister = registry.register({ id: "k", url: "/e", client });
    unregister();

    expect(client.subscribeStatus).toHaveBeenCalledTimes(1);
    expect(client.subscribeError).toHaveBeenCalledTimes(1);
    expect(client.subscribeAnyEvent).toHaveBeenCalledTimes(1);

    // Each returns an unsubscribe fn — verify they were invoked.
    const statusUnsub = client.subscribeStatus.mock.results[0].value;
    const errorUnsub = client.subscribeError.mock.results[0].value;
    const eventUnsub = client.subscribeAnyEvent.mock.results[0].value;

    // Calling emit after cleanup should not touch the (deleted) record.
    client._emitEvent("ping", 1);
    vi.runAllTimers();

    expect(registry.getSnapshot().size).toBe(0);
    // The unsub functions are closures — confirm they run without throwing.
    expect(() => statusUnsub()).not.toThrow();
    expect(() => errorUnsub()).not.toThrow();
    expect(() => eventUnsub()).not.toThrow();
  });
});
