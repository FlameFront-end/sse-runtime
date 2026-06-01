import { describe, expect, it, vi } from "vitest";

import { createSSEClient } from "../client/create-sse-client";
import type { SSEClient } from "../client/create-sse-client";
import type { CoordinationBackend, CoordinationChannel } from "./coordination-backend";
import type { CoordinationMessage } from "./coordination-message";

type ChatEvents = {
  readonly message: {
    readonly text: string;
  };
};

describe("single-tab coordination", () => {
  it("elects one leader and keeps followers connectionless", async () => {
    const harness = createCoordinationHarness();
    const leaderStream = createControlledStream();
    const leaderTransport = vi.fn(async () => new Response(leaderStream.readable));
    const followerTransport = vi.fn(async () => new Response(createControlledStream().readable));

    const leader = createCoordinatedClient(harness, leaderTransport);
    const follower = createCoordinatedClient(harness, followerTransport);

    await leader.connect();
    await waitFor(() => leader.getStatus() === "open");

    await follower.connect();
    await waitFor(() => follower.getStatus() === "open");

    expect(leaderTransport).toHaveBeenCalledTimes(1);
    expect(followerTransport).not.toHaveBeenCalled();

    leader.disconnect();
    follower.disconnect();
  });

  it("forwards events from the leader to follower handlers", async () => {
    const harness = createCoordinationHarness();
    const leaderStream = createControlledStream();
    const handleLeader = vi.fn();
    const handleFollower = vi.fn();

    const leader = createCoordinatedClient(
      harness,
      async () => new Response(leaderStream.readable),
      { message: handleLeader }
    );
    const follower = createCoordinatedClient(
      harness,
      async () => new Response(createControlledStream().readable),
      { message: handleFollower }
    );

    await leader.connect();
    await waitFor(() => leader.getStatus() === "open");
    await follower.connect();

    leaderStream.enqueue('event: message\ndata: {"text":"hi"}\n\n');

    await waitFor(() => handleFollower.mock.calls.length === 1);
    expect(handleFollower).toHaveBeenCalledWith({ text: "hi" });
    expect(handleLeader).toHaveBeenCalledWith({ text: "hi" });

    leader.disconnect();
    follower.disconnect();
  });

  it("diagnostics.onCoordinationRoleChange fires follower then leader for the winning tab", async () => {
    const harness = createCoordinationHarness();
    const onCoordinationRoleChange = vi.fn();

    const leader = createCoordinatedClient(
      harness,
      async () => new Response(createControlledStream().readable),
      undefined,
      { onCoordinationRoleChange }
    );

    await leader.connect();
    await waitFor(() => leader.getStatus() === "open");

    expect(onCoordinationRoleChange).toHaveBeenCalledTimes(2);
    expect(onCoordinationRoleChange).toHaveBeenNthCalledWith(1, { role: "follower" });
    expect(onCoordinationRoleChange).toHaveBeenNthCalledWith(2, { role: "leader" });
    leader.disconnect();
  });

  it("subscribeEvent on leader and follower both receive forwarded events", async () => {
    const harness = createCoordinationHarness();
    const leaderStream = createControlledStream();
    const leaderReceived: ChatEvents["message"][] = [];
    const followerReceived: ChatEvents["message"][] = [];

    const leader = createCoordinatedClient(
      harness,
      async () => new Response(leaderStream.readable)
    );
    const follower = createCoordinatedClient(
      harness,
      async () => new Response(createControlledStream().readable)
    );

    await leader.connect();
    await waitFor(() => leader.getStatus() === "open");
    await follower.connect();

    leader.subscribeEvent("message", (payload) => void leaderReceived.push(payload));
    follower.subscribeEvent("message", (payload) => void followerReceived.push(payload));

    leaderStream.enqueue('event: message\ndata: {"text":"hey"}\n\n');

    await waitFor(() => leaderReceived.length === 1 && followerReceived.length === 1);

    expect(leaderReceived).toEqual([{ text: "hey" }]);
    expect(followerReceived).toEqual([{ text: "hey" }]);

    leader.disconnect();
    follower.disconnect();
  });

  it("fails over to a follower when the leader disconnects", async () => {
    const harness = createCoordinationHarness();
    const leaderTransport = vi.fn(async () => new Response(createControlledStream().readable));
    const followerStream = createControlledStream();
    const followerTransport = vi.fn(async () => new Response(followerStream.readable));

    const leader = createCoordinatedClient(harness, leaderTransport);
    const follower = createCoordinatedClient(harness, followerTransport);

    await leader.connect();
    await waitFor(() => leader.getStatus() === "open");
    await follower.connect();

    expect(followerTransport).not.toHaveBeenCalled();

    leader.disconnect();

    await waitFor(() => followerTransport.mock.calls.length === 1);
    await waitFor(() => follower.getStatus() === "open");

    follower.disconnect();
  });
});

function createCoordinatedClient(
  harness: CoordinationHarness,
  transport: () => Promise<Response>,
  events?: Partial<{ message: (payload: ChatEvents["message"]) => void }>,
  diagnostics?: { onCoordinationRoleChange?: (info: { role: string }) => void }
): SSEClient<ChatEvents> {
  return createSSEClient<ChatEvents>(
    {
      key: ["chat"],
      url: "/stream",
      coordination: { enabled: true, mode: "single-tab" },
      events,
      diagnostics
    },
    {
      transport,
      coordinationBackend: harness.createBackend()
    }
  );
}

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
            for (const subscriber of [...subscribers]) {
              if (subscriber.name === name && subscriber.id !== id) {
                subscriber.listener(message);
              }
            }
          },
          subscribe(listener: (message: CoordinationMessage) => void): () => void {
            const subscriber: Subscriber = { name, id, listener };
            subscribers.push(subscriber);

            return () => {
              const index = subscribers.indexOf(subscriber);

              if (index >= 0) {
                subscribers.splice(index, 1);
              }
            };
          },
          close(): void {
            for (let index = subscribers.length - 1; index >= 0; index -= 1) {
              if (subscribers[index].id === id) {
                subscribers.splice(index, 1);
              }
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

          const waiter: Waiter = {
            signal,
            resolve,
            reject,
            onAbort: () => undefined
          };
          waiter.onAbort = () => {
            const index = currentEntry.queue.indexOf(waiter);

            if (index >= 0) {
              currentEntry.queue.splice(index, 1);
            }

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

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error("Condition was not met");
}
