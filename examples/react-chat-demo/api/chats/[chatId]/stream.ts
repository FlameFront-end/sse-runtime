export const config = { runtime: "edge" };

type FailureMode = "none" | "close-after-3" | "401-once" | "slow-start" | "bad-json";

const MESSAGES = [
  {
    author: "Mira Chen",
    text: "The account is connected. I am checking the onboarding checklist now."
  },
  {
    author: "SSE Bot",
    text: "Received customer profile, workspace settings, and billing status."
  },
  {
    author: "Mira Chen",
    text: "The import queue is moving. Progress events should update the dashboard."
  },
  {
    author: "SSE Bot",
    text: "Permissions verified. The next event will include the final summary."
  }
];

const MESSAGE_INTERVAL = 1400;

const pendingUnauthorized = new Map<string, boolean>();

export default function handler(request: Request): Response {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const chatsIdx = segments.indexOf("chats");
  const chatId = chatsIdx >= 0 ? (segments[chatsIdx + 1] ?? "unknown") : "unknown";
  const failure = (url.searchParams.get("failure") ?? "none") as FailureMode;

  if (failure === "401-once") {
    const key = chatId;
    if (pendingUnauthorized.get(key) !== false) {
      pendingUnauthorized.set(key, false);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    pendingUnauthorized.set(key, true);
  }

  const lastEventIdRaw = request.headers.get("last-event-id");
  const lastEventId = lastEventIdRaw ? Number(lastEventIdRaw) : 0;

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  void (async () => {
    try {
      if (failure === "slow-start") {
        await sleep(3000, request.signal);
        if (request.signal.aborted) return;
      }

      await writer.write(encoder.encode(": connected\n\n"));

      let eventId = Number.isFinite(lastEventId) ? lastEventId : 0;
      let progress = Math.min(eventId * 12, 96);
      let emittedCount = 0;

      while (!request.signal.aborted) {
        await sleep(MESSAGE_INTERVAL, request.signal);
        if (request.signal.aborted) break;

        eventId++;
        emittedCount++;
        progress = Math.min(progress + 12, 100);

        if (failure === "close-after-3" && emittedCount > 3) break;

        if (failure === "bad-json" && emittedCount === 2) {
          await writer.write(encoder.encode("event: message\ndata: {corrupted json\n\n"));
          await writer.write(encoder.encode(progressChunk(progress)));
          continue;
        }

        const msg = MESSAGES[(eventId - 1) % MESSAGES.length];
        const messagePayload = {
          id: String(eventId),
          author: msg.author,
          text: msg.text,
          timestamp: new Date().toISOString()
        };

        let chunk = `id: ${eventId}\n`;
        if (emittedCount === 1) chunk += "retry: 1000\n";
        chunk += `event: message\ndata: ${JSON.stringify(messagePayload)}\n\n`;

        await writer.write(encoder.encode(chunk));
        await writer.write(encoder.encode(progressChunk(progress)));

        if (progress === 100) {
          const donePayload = {
            chatId,
            summary: "The demo stream delivered messages, progress updates, and a final event."
          };
          await writer.write(
            encoder.encode(`event: done\ndata: ${JSON.stringify(donePayload)}\n\n`)
          );
          progress = 16;
        }
      }
    } catch {
      // client disconnected or writer closed
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no"
    }
  });
}

function progressChunk(value: number): string {
  const payload = {
    value,
    label: value === 100 ? "Conversation complete" : "Processing stream"
  };
  return `event: progress\ndata: ${JSON.stringify(payload)}\n\n`;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}
