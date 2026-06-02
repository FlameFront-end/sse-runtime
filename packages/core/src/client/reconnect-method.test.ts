import { describe, expect, it, vi } from "vitest";

import { createSSEClient } from "./create-sse-client";
import type { FetchTransportOptions } from "../transport/create-fetch-transport";

type ChatEvents = {
  readonly message: {
    readonly text: string;
  };
};

function createControlledStream(): {
  readonly readable: ReadableStream<Uint8Array>;
  readonly enqueue: (chunk: string) => void;
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
    close: () => controller?.close()
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Condition was not met");
}

describe("reconnect — local client", () => {
  it("forces a fresh connection even when already open", async () => {
    const transport = vi.fn(async () => new Response(createControlledStream().readable));
    const client = createSSEClient<ChatEvents>({ key: ["chat"], url: "/stream" }, { transport });

    await client.connect();
    await waitFor(() => client.getStatus() === "open");
    expect(transport).toHaveBeenCalledTimes(1);

    await client.reconnect();
    await waitFor(() => client.getStatus() === "open");

    expect(transport).toHaveBeenCalledTimes(2);
    client.disconnect();
  });

  it("resumes from the last event id on reconnect", async () => {
    const firstStream = createControlledStream();
    const headersByCall: Array<Record<string, string> | undefined> = [];
    const transport = vi.fn(async (options: FetchTransportOptions) => {
      headersByCall.push(options.headers);

      return new Response(
        headersByCall.length === 1 ? firstStream.readable : createControlledStream().readable
      );
    });
    const client = createSSEClient<ChatEvents>({ key: ["chat"], url: "/stream" }, { transport });

    await client.connect();
    await waitFor(() => client.getStatus() === "open");

    firstStream.enqueue('id: 7\nevent: message\ndata: {"text":"hi"}\n\n');
    await new Promise((resolve) => setTimeout(resolve, 0));

    await client.reconnect();
    await waitFor(() => transport.mock.calls.length === 2);

    expect(headersByCall[0]?.["Last-Event-ID"]).toBeUndefined();
    expect(headersByCall[1]?.["Last-Event-ID"]).toBe("7");
    client.disconnect();
  });

  it("does not emit a manual disconnect diagnostic", async () => {
    const onDisconnect = vi.fn();
    const transport = vi.fn(async () => new Response(createControlledStream().readable));
    const client = createSSEClient<ChatEvents>(
      { key: ["chat"], url: "/stream", diagnostics: { onDisconnect } },
      { transport }
    );

    await client.connect();
    await waitFor(() => client.getStatus() === "open");

    await client.reconnect();
    await waitFor(() => client.getStatus() === "open");

    expect(onDisconnect).not.toHaveBeenCalled();
    client.disconnect();

    expect(onDisconnect).toHaveBeenCalledWith({ url: "/stream", reason: "manual" });
  });
});
