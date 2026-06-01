import { describe, expect, it, vi } from "vitest";

import { createSSEClient } from "./create-sse-client";
import type { FetchTransportOptions } from "../transport/create-fetch-transport";
import type { SSEConnectionStatus } from "../types/public";

type ChatEvents = {
  readonly message: {
    readonly text: string;
  };
};

describe("createSSEClient", () => {
  it("moves through connecting and open statuses", async () => {
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream"
      },
      {
        transport: async () => new Response(stream.readable)
      }
    );
    const statuses: SSEConnectionStatus[] = [];

    client.subscribeStatus((status) => statuses.push(status));

    await client.connect();

    expect(statuses).toEqual(["closed", "connecting", "open"]);
    client.disconnect();
  });

  it("does not open a connection when disabled", async () => {
    const transport = vi.fn(async () => new Response(createControlledStream().readable));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        enabled: false
      },
      { transport }
    );

    await client.connect();

    expect(transport).not.toHaveBeenCalled();
    expect(client.getStatus()).toBe("idle");
  });

  it("dispatches parsed JSON payloads to event handlers", async () => {
    const stream = createControlledStream();
    const handleMessage = vi.fn();
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        events: {
          message: handleMessage
        }
      },
      {
        transport: async () => new Response(stream.readable)
      }
    );

    await client.connect();
    stream.enqueue('event: message\ndata: {"text":"hello"}\n\n');
    await waitFor(() => handleMessage.mock.calls.length === 1);

    expect(handleMessage).toHaveBeenCalledWith({ text: "hello" });
    client.disconnect();
  });

  it("aborts the active stream on manual disconnect", async () => {
    const stream = createControlledStream();
    let requestSignal: AbortSignal | undefined;
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream"
      },
      {
        transport: async (options: FetchTransportOptions) => {
          requestSignal = options.signal;

          return new Response(stream.readable);
        }
      }
    );

    await client.connect();
    client.disconnect();

    expect(getSignal(requestSignal).aborted).toBe(true);
    expect(client.getStatus()).toBe("closed");
  });

  it("does not open duplicate streams when connect is called twice", async () => {
    const stream = createControlledStream();
    const transport = vi.fn(async () => new Response(stream.readable));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream"
      },
      { transport }
    );

    await Promise.all([client.connect(), client.connect()]);

    expect(transport).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it("reconnects after an unexpected stream close", async () => {
    const firstStream = createControlledStream();
    const secondStream = createControlledStream();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(firstStream.readable))
      .mockResolvedValueOnce(new Response(secondStream.readable));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: {
          enabled: true,
          minDelay: 25,
          maxDelay: 25
        }
      },
      {
        transport,
        wait: async () => undefined
      }
    );

    await client.connect();
    firstStream.close();
    await waitFor(() => transport.mock.calls.length === 2);

    expect(client.getStatus()).toBe("open");
    client.disconnect();
  });

  it("does not reconnect when an event handler fails", async () => {
    const stream = createControlledStream();
    const transport = vi.fn(async () => new Response(stream.readable));
    const handlerError = new Error("handler failed");
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        events: {
          message: () => {
            throw handlerError;
          }
        }
      },
      { transport }
    );

    await client.connect();
    stream.enqueue('event: message\ndata: {"text":"hello"}\n\n');
    await waitFor(() => client.getError()?.cause === handlerError);

    expect(client.getStatus()).toBe("open");
    expect(transport).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it("flushes text decoder state before parser flush", async () => {
    const stream = createControlledStream();
    const handleMessage = vi.fn();
    const client = createSSEClient<{ readonly message: string }>(
      {
        key: ["chat"],
        url: "/stream",
        events: {
          message: handleMessage
        },
        reconnect: {
          enabled: false
        }
      },
      {
        transport: async () => new Response(stream.readable)
      }
    );
    const encoded = new TextEncoder().encode("data: привет\n\n");

    await client.connect();
    stream.enqueueBytes(encoded.slice(0, encoded.length - 1));
    stream.enqueueBytes(encoded.slice(encoded.length - 1));
    stream.close();
    await waitFor(() => handleMessage.mock.calls.length === 1);

    expect(handleMessage).toHaveBeenCalledWith("привет");
  });

  it("reconnects after a server error", async () => {
    const stream = createControlledStream();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(stream.readable));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: {
          enabled: true,
          minDelay: 25,
          maxDelay: 25
        }
      },
      {
        transport,
        wait: async () => undefined
      }
    );
    const statuses: SSEConnectionStatus[] = [];

    client.subscribeStatus((status) => statuses.push(status));

    await client.connect();
    await waitFor(() => transport.mock.calls.length === 2);

    expect(statuses).toEqual(["closed", "connecting", "reconnecting", "open"]);
    expect(client.getError()).toBeNull();
    client.disconnect();
  });

  it("does not reconnect after manual disconnect", async () => {
    const transport = vi.fn(async () => new Response(null, { status: 503 }));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: {
          enabled: true,
          minDelay: 25,
          maxDelay: 25
        }
      },
      {
        transport,
        wait: (_delay, signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          })
      }
    );

    await client.connect();
    await waitFor(() => client.getStatus() === "reconnecting");
    client.disconnect();
    await Promise.resolve();

    expect(client.getStatus()).toBe("closed");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("does not let stale reconnect tasks replace a newer connection", async () => {
    const reconnectWait = createDeferred<void>();
    const stream = createControlledStream();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(stream.readable));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: {
          enabled: true,
          minDelay: 25,
          maxDelay: 25
        }
      },
      {
        transport,
        wait: () => reconnectWait.promise
      }
    );

    await client.connect();
    await waitFor(() => client.getStatus() === "reconnecting");
    client.disconnect();
    await client.connect();
    reconnectWait.resolve();
    await Promise.resolve();

    expect(client.getStatus()).toBe("open");
    expect(transport).toHaveBeenCalledTimes(2);
    client.disconnect();
  });

  it("diagnostics.onAttempt is called on each connection attempt", async () => {
    const firstStream = createControlledStream();
    const secondStream = createControlledStream();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(firstStream.readable))
      .mockResolvedValueOnce(new Response(secondStream.readable));
    const onAttempt = vi.fn();
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: { enabled: true, minDelay: 0, maxDelay: 0 },
        diagnostics: { onAttempt }
      },
      { transport, wait: async () => undefined }
    );

    await client.connect();
    firstStream.close();
    await waitFor(() => transport.mock.calls.length === 2);

    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenNthCalledWith(1, { attempt: 0, url: "/stream" });
    expect(onAttempt).toHaveBeenNthCalledWith(2, { attempt: 1, url: "/stream" });
    client.disconnect();
  });

  it("diagnostics.onReconnectScheduled is called with delay and error", async () => {
    const stream = createControlledStream();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(stream.readable));
    const onReconnectScheduled = vi.fn();
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: { enabled: true, minDelay: 0, maxDelay: 0 },
        diagnostics: { onReconnectScheduled }
      },
      { transport, wait: async () => undefined }
    );

    await client.connect();
    await waitFor(() => transport.mock.calls.length === 2);

    expect(onReconnectScheduled).toHaveBeenCalledTimes(1);
    const [info] = onReconnectScheduled.mock.calls[0] as [
      { attempt: number; delay: number; error: { status?: number } }
    ];
    expect(info.attempt).toBe(1);
    expect(typeof info.delay).toBe("number");
    expect(info.error.status).toBe(503);
    client.disconnect();
  });

  it("diagnostics.onAuthRefresh is called on 401", async () => {
    const stream = createControlledStream();
    const onAuthRefresh = vi.fn();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(stream.readable));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        auth: { onUnauthorized: async () => undefined, retryAfterRefresh: true },
        diagnostics: { onAuthRefresh }
      },
      { transport }
    );

    await client.connect();
    await waitFor(() => transport.mock.calls.length === 2);

    expect(onAuthRefresh).toHaveBeenCalledTimes(1);
    const [info] = onAuthRefresh.mock.calls[0] as [{ error: { status?: number } }];
    expect(info.error.status).toBe(401);
    client.disconnect();
  });

  it("diagnostic callback error does not break the stream", async () => {
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        diagnostics: {
          onAttempt: () => {
            throw new Error("diagnostic failure");
          }
        }
      },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();

    expect(client.getStatus()).toBe("open");
    client.disconnect();
  });

  it("subscribeEvent receives parsed event payloads at runtime", async () => {
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: async () => new Response(stream.readable) }
    );
    const received: ChatEvents["message"][] = [];

    await client.connect();
    client.subscribeEvent("message", (payload) => void received.push(payload));

    stream.enqueue('event: message\ndata: {"text":"hello"}\n\n');
    await waitFor(() => received.length === 1);

    expect(received).toEqual([{ text: "hello" }]);
    client.disconnect();
  });

  it("subscribeEvent unsubscribe stops delivery", async () => {
    const stream = createControlledStream();
    const handler = vi.fn();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();
    const unsubscribe = client.subscribeEvent("message", handler);

    stream.enqueue('event: message\ndata: {"text":"first"}\n\n');
    await waitFor(() => handler.mock.calls.length === 1);

    unsubscribe();
    stream.enqueue('event: message\ndata: {"text":"second"}\n\n');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(handler).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it("multiple subscribeEvent subscribers all receive the same event", async () => {
    const stream = createControlledStream();
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();
    client.subscribeEvent("message", handlerA);
    client.subscribeEvent("message", handlerB);

    stream.enqueue('event: message\ndata: {"text":"hi"}\n\n');
    await waitFor(() => handlerA.mock.calls.length === 1 && handlerB.mock.calls.length === 1);

    expect(handlerA).toHaveBeenCalledWith({ text: "hi" });
    expect(handlerB).toHaveBeenCalledWith({ text: "hi" });
    client.disconnect();
  });

  it("subscribeEvent handler error is reported on the client without affecting the stream", async () => {
    const stream = createControlledStream();
    const handlerError = new Error("subscriber failed");
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: async () => new Response(stream.readable) }
    );

    await client.connect();
    client.subscribeEvent("message", () => {
      throw handlerError;
    });

    stream.enqueue('event: message\ndata: {"text":"hello"}\n\n');
    await waitFor(() => client.getError()?.cause === handlerError);

    expect(client.getStatus()).toBe("open");
    client.disconnect();
  });

  it("subscribeAnyEvent receives every event with its name and parsed payload", async () => {
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: async () => new Response(stream.readable) }
    );
    const received: Array<{ type: string; data: unknown }> = [];

    await client.connect();
    client.subscribeAnyEvent((event) => void received.push(event));

    stream.enqueue('event: message\ndata: {"text":"hello"}\n\n');
    stream.enqueue("event: ping\ndata: 42\n\n");
    await waitFor(() => received.length === 2);

    expect(received).toEqual([
      { type: "message", data: { text: "hello" } },
      { type: "ping", data: 42 }
    ]);
    client.disconnect();
  });

  it("subscribeAnyEvent fires even when no named handler is registered", async () => {
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: async () => new Response(stream.readable) }
    );
    const handler = vi.fn();

    await client.connect();
    const unsubscribe = client.subscribeAnyEvent(handler);

    stream.enqueue("event: custom\ndata: hi\n\n");
    await waitFor(() => handler.mock.calls.length === 1);

    expect(handler).toHaveBeenCalledWith({ type: "custom", data: "hi" });

    unsubscribe();
    stream.enqueue("event: custom\ndata: bye\n\n");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(handler).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it("subscribeAnyEvent handler error does not affect the stream or its error state", async () => {
    const stream = createControlledStream();
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream" },
      { transport: async () => new Response(stream.readable) }
    );
    const namedHandler = vi.fn();

    await client.connect();
    client.subscribeAnyEvent(() => {
      throw new Error("observer failed");
    });
    client.subscribeEvent("message", namedHandler);

    stream.enqueue('event: message\ndata: {"text":"hello"}\n\n');
    await waitFor(() => namedHandler.mock.calls.length === 1);

    expect(client.getStatus()).toBe("open");
    expect(client.getError()).toBeNull();
    client.disconnect();
  });

  it("does not let stale auth refresh attempts affect a newer connection", async () => {
    const refresh = createDeferred<void>();
    const stream = createControlledStream();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(stream.readable))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    const onUnauthorized = vi.fn(() => refresh.promise);
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        auth: {
          onUnauthorized
        },
        reconnect: {
          enabled: false
        }
      },
      { transport }
    );

    await client.connect();
    await waitFor(() => onUnauthorized.mock.calls.length === 1);
    client.disconnect();
    await client.connect();
    refresh.resolve();
    await Promise.resolve();
    client.disconnect();
    await client.connect();
    await waitFor(() => onUnauthorized.mock.calls.length === 2);

    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it("does not clear a newer pending connect promise from a stale connect", async () => {
    const firstHeaders = createDeferred<Record<string, string>>();
    const secondHeaders = createDeferred<Record<string, string>>();
    const stream = createControlledStream();
    let headerCallCount = 0;
    const transport = vi.fn(async () => new Response(stream.readable));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        headers: () => {
          headerCallCount += 1;

          return headerCallCount === 1 ? firstHeaders.promise : secondHeaders.promise;
        }
      },
      { transport }
    );

    const firstConnect = client.connect();
    await waitFor(() => headerCallCount === 1);
    client.disconnect();
    const secondConnect = client.connect();
    await waitFor(() => headerCallCount === 2);
    firstHeaders.resolve({});
    await firstConnect;
    void client.connect();

    expect(headerCallCount).toBe(2);
    secondHeaders.resolve({});
    await secondConnect;
    expect(transport).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it("does not start transport after disconnect while resolving headers", async () => {
    const headers = createDeferred<Record<string, string>>();
    const transport = vi.fn(async () => new Response(createControlledStream().readable));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        headers: () => headers.promise
      },
      { transport }
    );

    const connect = client.connect();
    client.disconnect();
    headers.resolve({});
    await connect;

    expect(transport).not.toHaveBeenCalled();
    expect(client.getStatus()).toBe("closed");
  });

  it("moves to error after max retries", async () => {
    const transport = vi.fn(async () => new Response(null, { status: 503 }));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        reconnect: {
          enabled: true,
          maxRetries: 2,
          minDelay: 25,
          maxDelay: 25
        }
      },
      {
        transport,
        wait: async () => undefined
      }
    );

    await client.connect();
    await waitFor(() => client.getStatus() === "error");

    expect(transport).toHaveBeenCalledTimes(3);
    expect(client.getError()?.status).toBe(503);
  });

  it("refreshes auth and reconnects after unauthorized response", async () => {
    const stream = createControlledStream();
    const onUnauthorized = vi.fn(async () => undefined);
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(stream.readable));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        auth: {
          onUnauthorized,
          retryAfterRefresh: true
        }
      },
      { transport }
    );

    await client.connect();
    await waitFor(() => transport.mock.calls.length === 2);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(client.getStatus()).toBe("open");
    expect(client.getError()).toBeNull();
    client.disconnect();
  });

  it("moves to error when auth refresh fails", async () => {
    const refreshError = new Error("refresh failed");
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        auth: {
          onUnauthorized: async () => {
            throw refreshError;
          }
        }
      },
      {
        transport: async () => new Response(null, { status: 401 })
      }
    );

    await client.connect();
    await waitFor(() => client.getStatus() === "error");

    expect(client.getError()?.cause).toBe(refreshError);
  });

  it("does not retry after auth refresh when manually disconnected", async () => {
    const refresh = createDeferred<void>();
    const transport = vi.fn(async () => new Response(null, { status: 401 }));
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        auth: {
          onUnauthorized: () => refresh.promise
        }
      },
      { transport }
    );

    await client.connect();
    await waitFor(() => transport.mock.calls.length === 1);
    client.disconnect();
    refresh.resolve();
    await Promise.resolve();

    expect(client.getStatus()).toBe("closed");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("stops repeated unauthorized refresh loops", async () => {
    const onUnauthorized = vi.fn(async () => undefined);
    const client = createSSEClient<ChatEvents>(
      {
        key: ["chat"],
        url: "/stream",
        auth: {
          onUnauthorized
        }
      },
      {
        transport: async () => new Response(null, { status: 401 })
      }
    );

    await client.connect();
    await waitFor(() => client.getStatus() === "error");

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

function createControlledStream(): {
  readonly readable: ReadableStream<Uint8Array>;
  readonly enqueue: (chunk: string) => void;
  readonly enqueueBytes: (chunk: Uint8Array) => void;
  readonly close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const readable = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    }
  });

  return {
    readable,
    enqueue(chunk: string): void {
      controller?.enqueue(encoder.encode(chunk));
    },
    enqueueBytes(chunk: Uint8Array): void {
      controller?.enqueue(chunk);
    },
    close(): void {
      controller?.close();
    }
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("Condition was not met");
}

function getSignal(signal: AbortSignal | undefined): AbortSignal {
  if (!signal) {
    throw new Error("Request signal was not captured");
  }

  return signal;
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (reason?: unknown) => void;
} {
  let resolveDeferred: ((value: T | PromiseLike<T>) => void) | undefined;
  let rejectDeferred: ((reason?: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });

  if (!resolveDeferred || !rejectDeferred) {
    throw new Error("Deferred promise was not initialized");
  }

  return {
    promise,
    resolve: resolveDeferred,
    reject: rejectDeferred
  };
}
