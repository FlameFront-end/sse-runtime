import type {
  CoordinationRole,
  SSEAnyEventHandler,
  SSEConnectionStatus,
  SSEError
} from "@flamefrontend/sse-runtime-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createReactNativeDevtoolsRegistry } from "./devtools-registry";

type StatusListener = (status: SSEConnectionStatus) => void;
type ErrorListener = (error: SSEError | null) => void;
type RoleListener = (role: CoordinationRole | null) => void;

function createMockClient(initialStatus: SSEConnectionStatus = "closed") {
  let status: SSEConnectionStatus = initialStatus;
  let error: SSEError | null = null;
  let role: CoordinationRole | null = null;
  const statusListeners = new Set<StatusListener>();
  const errorListeners = new Set<ErrorListener>();
  const roleListeners = new Set<RoleListener>();
  const anyEventHandlers = new Set<SSEAnyEventHandler>();

  return {
    getStatus: () => status,
    getError: () => error,
    getLastActivityAt: () => undefined,
    getLastEventAt: () => undefined,
    getLastRecovery: () => undefined,
    getRole: () => role,
    subscribeRole: vi.fn((listener: RoleListener) => {
      roleListeners.add(listener);
      listener(role);
      return () => roleListeners.delete(listener);
    }),
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    reconnect: vi.fn(async () => undefined),
    ensureOpen: vi.fn(async () => true),
    ensureHealthy: vi.fn(async () => true),
    subscribeActivity: vi.fn(() => () => undefined),
    subscribeRecovery: vi.fn(() => () => undefined),
    subscribeEvent: vi.fn(() => () => undefined),
    subscribeAnyEvent: vi.fn((handler: SSEAnyEventHandler) => {
      anyEventHandlers.add(handler);
      return () => anyEventHandlers.delete(handler);
    }),
    subscribeStatus: vi.fn((listener: StatusListener) => {
      statusListeners.add(listener);
      listener(status);
      return () => statusListeners.delete(listener);
    }),
    subscribeError: vi.fn((listener: ErrorListener) => {
      errorListeners.add(listener);
      listener(error);
      return () => errorListeners.delete(listener);
    }),
    _setStatus(next: SSEConnectionStatus) {
      status = next;
      for (const listener of statusListeners) listener(status);
    },
    _setError(next: SSEError | null) {
      error = next;
      for (const listener of errorListeners) listener(error);
    },
    _setRole(next: CoordinationRole | null) {
      role = next;
      for (const listener of roleListeners) listener(role);
    },
    _emitEvent(type: string, data: unknown) {
      const raw = typeof data === "string" ? data : JSON.stringify(data);
      for (const handler of anyEventHandlers) void handler({ type, data, raw });
    }
  };
}

describe("createReactNativeDevtoolsRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers a React Native SSE client and exposes a snapshot record", () => {
    const registry = createReactNativeDevtoolsRegistry();
    const client = createMockClient("open");

    registry.register({ id: "chat", url: "/sse", client });
    vi.runAllTimers();

    const [record] = [...registry.getSnapshot().values()];
    expect(record.key).toBe("chat");
    expect(record.url).toBe("/sse");
    expect(record.status).toBe("open");
    expect(record.connectedAt).toBeGreaterThan(0);
  });

  it("tracks role, status, error, event counters, and clearEvents", () => {
    const registry = createReactNativeDevtoolsRegistry({ maxEvents: 2 });
    const client = createMockClient("closed");
    const error: SSEError = {
      kind: "transport",
      message: "network failed",
      status: 503,
      cause: undefined
    };

    registry.register({ id: "chat", url: "/sse", client });
    client._setStatus("open");
    client._setRole("leader");
    client._setError(error);
    client._emitEvent("delta", { token: "a" });
    client._emitEvent("delta", { token: "b" });
    client._emitEvent("message", { id: "m1" });
    vi.runAllTimers();

    const [id, record] = [...registry.getSnapshot().entries()][0];
    expect(record.status).toBe("open");
    expect(record.role).toBe("leader");
    expect(record.error).toBe(error);
    expect(record.events).toHaveLength(2);
    expect(record.events.map((event) => event.type)).toEqual(["delta", "message"]);
    expect(record.totalEvents).toBe(3);

    registry.clearEvents(id);
    vi.runAllTimers();

    const cleared = registry.getSnapshot().get(id);
    expect(cleared?.events).toHaveLength(0);
    expect(cleared?.totalEvents).toBe(0);
  });

  it("unregisters the record and client subscriptions on cleanup", () => {
    const registry = createReactNativeDevtoolsRegistry();
    const client = createMockClient();

    const unregister = registry.register({ id: "chat", url: "/sse", client });
    unregister();
    vi.runAllTimers();

    expect(registry.getSnapshot().size).toBe(0);
    expect(client.subscribeStatus).toHaveBeenCalledTimes(1);
    expect(client.subscribeError).toHaveBeenCalledTimes(1);
    expect(client.subscribeAnyEvent).toHaveBeenCalledTimes(1);
  });
});
