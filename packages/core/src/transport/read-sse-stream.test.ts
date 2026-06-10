import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readSSEStream } from "./read-sse-stream";

describe("readSSEStream", () => {
  it("reads parsed events from a stream", async () => {
    const stream = createControlledStream();
    const onEvents = vi.fn(async () => undefined);
    const streamTask = readSSEStream({
      stream: stream.readable,
      signal: new AbortController().signal,
      createTextDecoder: () => new TextDecoder(),
      onEvents
    });

    stream.enqueue("event: message\ndata: hello\n\n");
    stream.close();
    const result = await streamTask;

    expect(onEvents).toHaveBeenCalledWith([
      {
        event: "message",
        data: "hello",
        id: undefined,
        retry: undefined
      }
    ]);
    expect(result?.kind).toBe("transport");
  });

  it("cancels the reader on abort without returning a stream error", async () => {
    const stream = createControlledStream();
    const abortController = new AbortController();
    const streamTask = readSSEStream({
      stream: stream.readable,
      signal: abortController.signal,
      createTextDecoder: () => new TextDecoder(),
      onEvents: async () => undefined
    });

    abortController.abort();

    await expect(streamTask).resolves.toBeNull();
  });
});

describe("readSSEStream - heartbeat timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a transport error when no data arrives within heartbeat timeout", async () => {
    const stream = createControlledStream();
    const streamTask = readSSEStream({
      stream: stream.readable,
      signal: new AbortController().signal,
      createTextDecoder: () => new TextDecoder(),
      onEvents: async () => undefined,
      heartbeatTimeout: 5000
    });

    await vi.advanceTimersByTimeAsync(5001);

    const result = await streamTask;
    expect(result?.kind).toBe("transport");
    expect(result?.message).toMatch(/heartbeat/i);
  });

  it("resets the heartbeat timer on each received chunk", async () => {
    const stream = createControlledStream();
    const onEvents = vi.fn(async () => undefined);
    const streamTask = readSSEStream({
      stream: stream.readable,
      signal: new AbortController().signal,
      createTextDecoder: () => new TextDecoder(),
      onEvents,
      heartbeatTimeout: 100
    });

    // Advance to just before first timeout, then send data to reset the timer
    await vi.advanceTimersByTimeAsync(80);
    stream.enqueue("data: ping\n\n");

    // Advance again to just before the reset deadline — should not timeout yet
    await vi.advanceTimersByTimeAsync(80);
    expect(onEvents).toHaveBeenCalledTimes(1);

    // Now let the timer expire
    await vi.advanceTimersByTimeAsync(30);

    const result = await streamTask;
    expect(result?.kind).toBe("transport");
    expect(result?.message).toMatch(/heartbeat/i);
  });

  it("does not time out when not configured", async () => {
    const stream = createControlledStream();
    const onEvents = vi.fn(async () => undefined);
    const streamTask = readSSEStream({
      stream: stream.readable,
      signal: new AbortController().signal,
      createTextDecoder: () => new TextDecoder(),
      onEvents
    });

    await vi.advanceTimersByTimeAsync(60_000);

    stream.enqueue("data: late\n\n");
    stream.close();

    await streamTask;
    expect(onEvents).toHaveBeenCalledWith([
      { event: "message", data: "late", id: undefined, retry: undefined }
    ]);
  });

  it("does not count handler processing time against the heartbeat budget", async () => {
    const stream = createControlledStream();
    let releaseHandler: (() => void) | undefined;
    const onEvents = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseHandler = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const streamTask = readSSEStream({
      stream: stream.readable,
      signal: new AbortController().signal,
      createTextDecoder: () => new TextDecoder(),
      onEvents,
      heartbeatTimeout: 100
    });

    stream.enqueue("data: ping\n\n");
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(1000);
    releaseHandler?.();
    await vi.advanceTimersByTimeAsync(0);

    stream.close();
    const result = await streamTask;

    expect(result?.message).not.toMatch(/heartbeat/i);
  });

  it("does not return a heartbeat error when aborted externally before timeout", async () => {
    const stream = createControlledStream();
    const abortController = new AbortController();
    const streamTask = readSSEStream({
      stream: stream.readable,
      signal: abortController.signal,
      createTextDecoder: () => new TextDecoder(),
      onEvents: async () => undefined,
      heartbeatTimeout: 5000
    });

    await vi.advanceTimersByTimeAsync(1000);
    abortController.abort();

    const result = await streamTask;
    expect(result).toBeNull();
  });

  it("reports transport activity for comment-only heartbeat chunks", async () => {
    const stream = createControlledStream();
    const onActivity = vi.fn();
    const streamTask = readSSEStream({
      stream: stream.readable,
      signal: new AbortController().signal,
      createTextDecoder: () => new TextDecoder(),
      onEvents: async () => undefined,
      onActivity
    });

    stream.enqueue(": heartbeat\n\n");
    await vi.waitFor(() => expect(onActivity).toHaveBeenCalledTimes(1));
    stream.close();

    await streamTask;
  });
});

function createControlledStream(): {
  readonly readable: ReadableStream<Uint8Array>;
  readonly enqueue: (chunk: string) => void;
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
    close(): void {
      controller?.close();
    }
  };
}
