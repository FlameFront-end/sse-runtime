import { describe, expect, it, vi } from "vitest";

import { createSSEClient } from "./create-sse-client";
import type { FetchTransportOptions } from "../transport/create-fetch-transport";
import type { SSEError } from "../types/public";
import type {
  CoordinationBackend,
  CoordinationChannel
} from "../coordination/coordination-backend";
import type { CoordinationMessage } from "../coordination/coordination-message";

type ChatEvents = {
  readonly message: {
    readonly text: string;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createControlledStream(): {
  readonly readable: ReadableStream<Uint8Array>;
  readonly enqueue: (chunk: string) => void;
  readonly enqueueBytes: (chunk: Uint8Array) => void;
  readonly close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    }
  });

  return {
    readable,
    enqueue: (chunk) => controller?.enqueue(encoder.encode(chunk)),
    enqueueBytes: (chunk) => controller?.enqueue(chunk),
    close: () => controller?.close()
  };
}

async function waitFor(predicate: () => boolean, maxAttempts = 20): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Condition was not met");
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// ensureOpen — local client
// ---------------------------------------------------------------------------

describe("ensureOpen — local client", () => {
  it("resolves true when already open", async () => {
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();
    const result = await client.ensureOpen();

    expect(result).toBe(true);
    client.disconnect();
  });

  it("connects on demand even when disabled (enabled only gates auto-connect)", async () => {
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", enabled: false },
      { transport: async () => new Response(stream.readable) }
    );

    const result = await client.ensureOpen();

    expect(result).toBe(true);
    client.disconnect();
  });

  it("connects and resolves true from closed state", async () => {
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: async () => new Response(stream.readable) }
    );

    const result = await client.ensureOpen();

    expect(result).toBe(true);
    client.disconnect();
  });

  it("resolves false when connection reaches error state", async () => {
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: { enabled: false }
      },
      { transport: async () => new Response(null, { status: 503 }) }
    );

    const result = await client.ensureOpen();

    expect(result).toBe(false);
  });

  it("deduplicates concurrent ensureOpen calls — only one connect()", async () => {
    const stream = createControlledStream();
    const transport = vi.fn(async () => new Response(stream.readable));
    const client = createSSEClient<ChatEvents>({ key: ["chat"], url: "/stream" }, { transport });

    const [r1, r2, r3] = await Promise.all([
      client.ensureOpen(),
      client.ensureOpen(),
      client.ensureOpen()
    ]);

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it("resolves true when called while connecting", async () => {
    const stream = createControlledStream();
    const connectDeferred = createDeferred<Response>();
    const transport = vi.fn(() => connectDeferred.promise);
    const client = createSSEClient<ChatEvents>({ key: ["chat"], url: "/stream" }, { transport });

    void client.connect();
    await waitFor(() => client.getStatus() === "connecting");

    const ensurePromise = client.ensureOpen();
    connectDeferred.resolve(new Response(stream.readable));

    const result = await ensurePromise;

    expect(result).toBe(true);
    client.disconnect();
  });

  it("rejects when timeout expires before connection opens", async () => {
    const connectDeferred = createDeferred<Response>();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: () => connectDeferred.promise }
    );

    await expect(client.ensureOpen({ timeout: 10 })).rejects.toThrow("timed out");

    connectDeferred.resolve(new Response(null, { status: 200 }));
    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// openTimeout
// ---------------------------------------------------------------------------

describe("openTimeout", () => {
  it("aborts the request if it does not open within the timeout", async () => {
    let capturedSignal: AbortSignal | undefined;
    const transport = vi.fn((opts: FetchTransportOptions) => {
      capturedSignal = opts.signal;
      // Real fetch respects the signal; simulate that behaviour here
      return new Promise<Response>((_, reject) => {
        opts.signal.addEventListener("abort", () => reject(opts.signal.reason), { once: true });
      });
    });

    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", openTimeout: 20, reconnect: { enabled: false } },
      { transport }
    );

    await client.connect();

    expect(capturedSignal?.aborted).toBe(true);
    expect(client.getStatus()).toBe("error");
  });

  it("does not abort the signal on a successful open", async () => {
    const stream = createControlledStream();
    let capturedSignal: AbortSignal | undefined;
    const transport = vi.fn((opts: FetchTransportOptions) => {
      capturedSignal = opts.signal;
      return Promise.resolve(new Response(stream.readable));
    });

    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", openTimeout: 5000 },
      { transport }
    );

    await client.connect();

    expect(capturedSignal?.aborted).toBe(false);
    client.disconnect();
  });

  it("integrates with reconnect policy after a timeout", async () => {
    const stream = createControlledStream();
    const transport = vi
      .fn()
      .mockImplementationOnce((opts: FetchTransportOptions) => {
        // Block forever — let the timeout fire
        return new Promise<Response>((_, reject) => {
          opts.signal.addEventListener("abort", () => reject(opts.signal.reason), { once: true });
        });
      })
      .mockResolvedValueOnce(new Response(stream.readable));

    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        openTimeout: 20,
        reconnect: { enabled: true, maxRetries: 1, minDelay: 0, maxDelay: 0 }
      },
      { transport, wait: async () => undefined }
    );

    await client.connect();
    await waitFor(() => client.getStatus() === "open");

    expect(transport).toHaveBeenCalledTimes(2);
    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Retry policy
// ---------------------------------------------------------------------------

describe("retry policy", () => {
  it("shouldRetry: false prevents any reconnect", async () => {
    const transport = vi.fn(async () => new Response(null, { status: 503 }));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        retry: { shouldRetry: () => false }
      },
      { transport }
    );

    await client.connect();

    expect(client.getStatus()).toBe("error");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("shouldRetry: true allows retry even for normally-terminal 4xx", async () => {
    const stream = createControlledStream();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(stream.readable));

    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        retry: { shouldRetry: (error) => error.status === 403 }
      },
      { transport, wait: async () => undefined }
    );

    await client.connect();
    await waitFor(() => client.getStatus() === "open");

    expect(transport).toHaveBeenCalledTimes(2);
    client.disconnect();
  });

  it("stops retrying after maxRetries is exhausted (default policy)", async () => {
    const transport = vi.fn(async () => new Response(null, { status: 503 }));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: { enabled: true, maxRetries: 1, minDelay: 0, maxDelay: 0 }
      },
      { transport, wait: async () => undefined }
    );

    await client.connect();
    await waitFor(() => client.getStatus() === "error");

    expect(transport).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("getDelay is used to compute the reconnect delay", async () => {
    const stream = createControlledStream();
    const getDelay = vi.fn(() => 0);
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(stream.readable));

    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        retry: {
          shouldRetry: () => true,
          getDelay
        }
      },
      { transport, wait: async () => undefined }
    );

    await client.connect();
    await waitFor(() => transport.mock.calls.length === 2);

    expect(getDelay).toHaveBeenCalledTimes(1);
    const ctx = (getDelay.mock.calls[0] as unknown as [{ attempt: number; error: SSEError }])[0];
    expect(ctx.attempt).toBe(1);
    expect(ctx.error.status).toBe(503);
    client.disconnect();
  });

  it("getDelay receives serverRetry from SSE retry field", async () => {
    const firstStream = createControlledStream();
    const secondStream = createControlledStream();
    const getDelay = vi.fn(() => 0);
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(firstStream.readable))
      .mockResolvedValueOnce(new Response(secondStream.readable));

    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        retry: { shouldRetry: () => true, getDelay }
      },
      { transport, wait: async () => undefined }
    );

    await client.connect();
    // Send data alongside retry so the parser dispatches the event and updates serverRetryDelay
    firstStream.enqueue('event: message\ndata: {"text":"hi"}\nretry: 7000\n\n');
    firstStream.close();
    await waitFor(() => transport.mock.calls.length === 2);

    const ctx = (getDelay.mock.calls[0] as unknown as [{ serverRetry: number | undefined }])[0];
    expect(ctx.serverRetry).toBe(7000);
    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Raw diagnostics
// ---------------------------------------------------------------------------

describe("diagnostics — new callbacks", () => {
  it("onOpen fires when connection opens", async () => {
    const stream = createControlledStream();
    const onOpen = vi.fn();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", diagnostics: { onOpen } },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();

    expect(onOpen).toHaveBeenCalledWith({ url: "/stream" });
    client.disconnect();
  });

  it("onDisconnect fires with reason=manual on disconnect()", async () => {
    const stream = createControlledStream();
    const onDisconnect = vi.fn();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", diagnostics: { onDisconnect } },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();
    client.disconnect();

    expect(onDisconnect).toHaveBeenCalledWith({ url: "/stream", reason: "manual" });
  });

  it("onDisconnect fires with reason=error when terminal error occurs", async () => {
    const onDisconnect = vi.fn();
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: { enabled: false },
        diagnostics: { onDisconnect }
      },
      { transport: async () => new Response(null, { status: 503 }) }
    );

    await client.connect();

    expect(onDisconnect).toHaveBeenCalledWith({ url: "/stream", reason: "error" });
  });

  it("onDisconnect fires with reason=stream-ended when stream closes naturally", async () => {
    const stream = createControlledStream();
    const onDisconnect = vi.fn();
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: { enabled: false },
        diagnostics: { onDisconnect }
      },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();
    stream.close();
    await waitFor(() => onDisconnect.mock.calls.length === 1);

    expect(onDisconnect).toHaveBeenCalledWith({ url: "/stream", reason: "stream-ended" });
    client.disconnect();
  });

  it("onRawEvent fires for each received SSE event with correct fields", async () => {
    const stream = createControlledStream();
    const onRawEvent = vi.fn();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", diagnostics: { onRawEvent } },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();
    stream.enqueue('id: 5\nevent: message\ndata: {"text":"hi"}\n\n');
    await waitFor(() => onRawEvent.mock.calls.length === 1);

    const [info] = onRawEvent.mock.calls[0] as [
      { event: string; data: string; id: string; timestamp: number; connectionKey: string[] }
    ];
    expect(info.event).toBe("message");
    expect(info.data).toBe('{"text":"hi"}');
    expect(info.id).toBe("5");
    expect(typeof info.timestamp).toBe("number");
    expect(info.connectionKey).toEqual(["chat"]);
    client.disconnect();
  });

  it("onParseError fires when strict JSON parsing fails for a subscribeEvent handler", async () => {
    const stream = createControlledStream();
    const onParseError = vi.fn();
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        diagnostics: { onParseError }
      },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();
    // Register via subscribeEvent — this path calls parseEventPayloadStrict
    client.subscribeEvent("message", vi.fn());
    // Send a JSON-like payload that fails JSON.parse
    stream.enqueue("event: message\ndata: {invalid}\n\n");
    await waitFor(() => onParseError.mock.calls.length === 1);

    const info = (onParseError.mock.calls[0] as unknown as [{ eventName: string }])[0];
    expect(info.eventName).toBe("message");
    client.disconnect();
  });

  it("diagnostic errors do not affect the stream for new callbacks", async () => {
    const stream = createControlledStream();
    const received: ChatEvents["message"][] = [];
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        diagnostics: {
          onOpen: () => {
            throw new Error("onOpen failure");
          },
          onRawEvent: () => {
            throw new Error("onRawEvent failure");
          }
        }
      },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();
    client.subscribeEvent("message", (p) => void received.push(p));
    stream.enqueue('event: message\ndata: {"text":"ok"}\n\n');
    await waitFor(() => received.length === 1);

    expect(received).toEqual([{ text: "ok" }]);
    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// ensureOpen — coordinated client
// ---------------------------------------------------------------------------

describe("ensureOpen — coordinated client", () => {
  it("follower resolves true after leader opens", async () => {
    const harness = createCoordinationHarness();
    const leaderStream = createControlledStream();

    const leader = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", coordination: { enabled: true, mode: "single-tab" } },
      {
        transport: async () => new Response(leaderStream.readable),
        coordinationBackend: harness.createBackend()
      }
    );
    const follower = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", coordination: { enabled: true, mode: "single-tab" } },
      {
        transport: vi.fn(),
        coordinationBackend: harness.createBackend()
      }
    );

    await leader.connect();
    await waitFor(() => leader.getStatus() === "open");

    const followerReady = follower.ensureOpen();
    const result = await followerReady;

    expect(result).toBe(true);
    leader.disconnect();
    follower.disconnect();
  });

  it("connects on demand even when disabled (enabled only gates auto-connect)", async () => {
    const harness = createCoordinationHarness();
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        enabled: false,
        coordination: { enabled: true, mode: "single-tab" }
      },
      {
        transport: async () => new Response(stream.readable),
        coordinationBackend: harness.createBackend()
      }
    );

    const result = await client.ensureOpen();

    expect(result).toBe(true);
    client.disconnect();
  });

  it("rejects when timeout expires before leader grants open status", async () => {
    const harness = createCoordinationHarness();
    const connectDeferred = createDeferred<Response>();

    const leader = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", coordination: { enabled: true, mode: "single-tab" } },
      {
        transport: () => connectDeferred.promise,
        coordinationBackend: harness.createBackend()
      }
    );
    const follower = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", coordination: { enabled: true, mode: "single-tab" } },
      {
        transport: vi.fn(),
        coordinationBackend: harness.createBackend()
      }
    );

    await leader.connect();

    await expect(follower.ensureOpen({ timeout: 20 })).rejects.toThrow("timed out");

    connectDeferred.resolve(new Response(null));
    leader.disconnect();
    follower.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Coordination: additional coverage (Priority 6)
// ---------------------------------------------------------------------------

describe("coordination — additional coverage", () => {
  it("follower handler errors do not affect leader connection state", async () => {
    const harness = createCoordinationHarness();
    const leaderStream = createControlledStream();

    const leader = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", coordination: { enabled: true, mode: "single-tab" } },
      {
        transport: async () => new Response(leaderStream.readable),
        coordinationBackend: harness.createBackend()
      }
    );
    const follower = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        coordination: { enabled: true, mode: "single-tab" },
        events: {
          message: () => {
            throw new Error("follower handler failure");
          }
        }
      },
      {
        transport: vi.fn(),
        coordinationBackend: harness.createBackend()
      }
    );

    await leader.connect();
    await waitFor(() => leader.getStatus() === "open");
    await follower.connect();
    await waitFor(() => follower.getStatus() === "open");

    leaderStream.enqueue('event: message\ndata: {"text":"hello"}\n\n');
    await waitFor(() => follower.getError() !== null);

    // Leader must stay open
    expect(leader.getStatus()).toBe("open");
    expect(leader.getError()).toBeNull();

    leader.disconnect();
    follower.disconnect();
  });

  it("no duplicate leaders during quick mount/unmount churn", async () => {
    const harness = createCoordinationHarness();
    const transportCalls: number[] = [];
    const makeTransport = (id: number) =>
      vi.fn(async () => {
        transportCalls.push(id);
        return new Response(createControlledStream().readable);
      });

    const clients = Array.from({ length: 3 }, (_, i) =>
      createSSEClient<ChatEvents>(
        { key: ["chat"], url: "/stream", coordination: { enabled: true, mode: "single-tab" } },
        {
          transport: makeTransport(i),
          coordinationBackend: harness.createBackend()
        }
      )
    );

    // Connect all simultaneously
    await Promise.all(clients.map((c) => c.connect()));
    await waitFor(() => clients.every((c) => c.getStatus() === "open"));

    // Exactly one should have opened a real transport
    expect(transportCalls).toHaveLength(1);

    clients.forEach((c) => c.disconnect());
  });

  it("follower receives events in correct order", async () => {
    const harness = createCoordinationHarness();
    const leaderStream = createControlledStream();
    const received: number[] = [];

    const leader = createSSEClient<{ seq: number }>(
      { key: ["seq"], url: "/stream", coordination: { enabled: true, mode: "single-tab" } },
      {
        transport: async () => new Response(leaderStream.readable),
        coordinationBackend: harness.createBackend()
      }
    );
    const follower = createSSEClient<{ seq: number }>(
      {
        key: ["seq"],
        url: "/stream",
        coordination: { enabled: true, mode: "single-tab" }
      },
      {
        transport: vi.fn(),
        coordinationBackend: harness.createBackend()
      }
    );

    await leader.connect();
    await waitFor(() => leader.getStatus() === "open");
    await follower.connect();

    follower.subscribeEvent("seq", (p) => void received.push(p));

    for (let i = 1; i <= 5; i++) {
      leaderStream.enqueue(`event: seq\ndata: ${String(i)}\n\n`);
    }

    await waitFor(() => received.length === 5);

    expect(received).toEqual([1, 2, 3, 4, 5]);
    leader.disconnect();
    follower.disconnect();
  });
});

// ---------------------------------------------------------------------------
// React StrictMode double-mount (simulated)
// ---------------------------------------------------------------------------

describe("StrictMode double-mount simulation", () => {
  it("handles rapid connect → disconnect → connect without leaking", async () => {
    const stream = createControlledStream();
    const transport = vi.fn(async () => new Response(stream.readable));
    const client = createSSEClient<ChatEvents>({ key: ["chat"], url: "/stream" }, { transport });

    // StrictMode mounts, unmounts, then mounts again
    void client.connect();
    client.disconnect();
    await client.connect();

    expect(client.getStatus()).toBe("open");
    expect(transport).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it("connect is idempotent while already connecting", async () => {
    const stream = createControlledStream();
    const transport = vi.fn(async () => new Response(stream.readable));
    const client = createSSEClient<ChatEvents>({ key: ["chat"], url: "/stream" }, { transport });

    await Promise.all([client.connect(), client.connect(), client.connect()]);

    expect(transport).toHaveBeenCalledTimes(1);
    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// Coordination harness (copied from existing test)
// ---------------------------------------------------------------------------

type CoordinationHarness = {
  readonly createBackend: () => CoordinationBackend;
};

type Subscriber = {
  readonly name: string;
  readonly id: number;
  readonly listener: (message: CoordinationMessage) => void;
};

type Waiter = {
  readonly signal: AbortSignal;
  readonly resolve: () => void;
  readonly reject: (reason: unknown) => void;
  onAbort: () => void;
};

type LockEntry = {
  holder: AbortSignal | null;
  readonly queue: Waiter[];
};

function createCoordinationHarness(): CoordinationHarness {
  const subscribers: Subscriber[] = [];
  const locks = new Map<string, LockEntry>();
  let nextChannelId = 1;

  function grant(entry: LockEntry, signal: AbortSignal, resolve: () => void): void {
    entry.holder = signal;
    resolve();

    const onRelease = (): void => {
      entry.holder = null;
      const next = entry.queue.shift();
      if (next) {
        next.signal.removeEventListener("abort", next.onAbort);
        grant(entry, next.signal, next.resolve);
      }
    };

    if (signal.aborted) {
      onRelease();
      return;
    }

    signal.addEventListener("abort", onRelease, { once: true });
  }

  function createBackend(): CoordinationBackend {
    return {
      createChannel(name: string): CoordinationChannel {
        const id = nextChannelId++;

        return {
          post(message: CoordinationMessage): void {
            for (const sub of [...subscribers]) {
              if (sub.name === name && sub.id !== id) sub.listener(message);
            }
          },
          subscribe(listener: (message: CoordinationMessage) => void): () => void {
            const sub: Subscriber = { name, id, listener };
            subscribers.push(sub);
            return () => {
              const idx = subscribers.indexOf(sub);
              if (idx >= 0) subscribers.splice(idx, 1);
            };
          },
          close(): void {
            for (let i = subscribers.length - 1; i >= 0; i--) {
              if (subscribers[i].id === id) subscribers.splice(i, 1);
            }
          }
        };
      },

      requestLeadership(name: string, signal: AbortSignal): Promise<void> {
        return new Promise<void>((resolve, reject) => {
          let entry = locks.get(name);
          if (!entry) {
            entry = { holder: null, queue: [] };
            locks.set(name, entry);
          }
          const currentEntry = entry;

          if (!currentEntry.holder) {
            grant(currentEntry, signal, resolve);
            return;
          }

          const waiter: Waiter = { signal, resolve, reject, onAbort: () => undefined };
          waiter.onAbort = () => {
            const idx = currentEntry.queue.indexOf(waiter);
            if (idx >= 0) currentEntry.queue.splice(idx, 1);
            reject(new Error("Leadership request aborted"));
          };

          if (signal.aborted) {
            waiter.onAbort();
            return;
          }

          signal.addEventListener("abort", waiter.onAbort, { once: true });
          currentEntry.queue.push(waiter);
        });
      }
    };
  }

  return { createBackend };
}
