import type { ServerResponse } from "node:http";
import type { Plugin } from "vite";

type ChatMessage = {
  readonly author: string;
  readonly text: string;
};

type SSEEvent = {
  readonly id?: string;
  readonly event: string;
  readonly payload: unknown;
  readonly retry?: number;
};

export type FailureMode = "none" | "close-after-3" | "401-once" | "slow-start" | "bad-json";

const CHAT_ID = "demo-chat";
const STREAM_PATH = `/api/chats/${CHAT_ID}/stream`;
const MESSAGE_INTERVAL = 1400;

const CHAT_MESSAGES: readonly ChatMessage[] = [
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

// Tracks whether the 401-once mode has already sent a 401 for the current cycle.
// Resets to false after a successful connection, so the pattern repeats: 401 → 200 → 401 → 200.
let pendingUnauthorized = true;

export function createMockSSEServer(): Plugin {
  return {
    name: "mock-sse-server",
    configureServer(server): void {
      server.middlewares.use(STREAM_PATH, (request, response) => {
        if (request.method !== "GET") {
          response.statusCode = 405;
          response.end("Method Not Allowed");
          return;
        }

        const url = new URL(request.url ?? "/", "http://localhost");
        const failure = (url.searchParams.get("failure") ?? "none") as FailureMode;

        if (failure === "401-once" && pendingUnauthorized) {
          pendingUnauthorized = false;
          response.statusCode = 401;
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }

        // Reset so next disconnect→connect cycle triggers 401 again
        pendingUnauthorized = true;

        const lastEventId = Number(request.headers["last-event-id"] ?? 0);

        if (failure === "slow-start") {
          const timer = setTimeout(() => {
            if (!response.writableEnded) {
              startChatStream(response, lastEventId, failure);
            }
          }, 3000);
          request.on("close", () => {
            clearTimeout(timer);
            response.end();
          });
          return;
        }

        startChatStream(response, lastEventId, failure);
        request.on("close", () => response.end());
      });
    }
  };
}

function startChatStream(
  response: ServerResponse,
  lastEventId: number,
  failure: FailureMode
): void {
  let eventId = Number.isFinite(lastEventId) ? lastEventId : 0;
  let progress = Math.min(eventId * 12, 96);
  let emittedEventCount = 0;

  response.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "X-Accel-Buffering": "no"
  });
  response.write(": connected\n\n");

  const intervalId = setInterval(() => {
    eventId += 1;
    emittedEventCount += 1;
    progress = Math.min(progress + 12, 100);

    // close-after-3: stop the stream after 3 message events
    if (failure === "close-after-3" && emittedEventCount > 3) {
      clearInterval(intervalId);
      response.end();
      return;
    }

    // bad-json: corrupt the payload on the second event
    if (failure === "bad-json" && emittedEventCount === 2) {
      response.write(`event: message\n`);
      response.write(`data: {corrupted json\n\n`);
      writeEvent(response, createProgressEvent(progress));
      return;
    }

    const messageEvent = createMessageEvent(eventId);

    // retry-field: advertise a 1 s reconnect delay on the first event
    if (failure === "none" || emittedEventCount === 1) {
      writeEvent(response, { ...messageEvent, retry: emittedEventCount === 1 ? 1000 : undefined });
    } else {
      writeEvent(response, messageEvent);
    }

    writeEvent(response, createProgressEvent(progress));

    if (progress === 100) {
      writeEvent(response, createDoneEvent());
      progress = 16;
    }
  }, MESSAGE_INTERVAL);

  response.on("close", () => clearInterval(intervalId));
}

function createMessageEvent(eventId: number): SSEEvent {
  const message = CHAT_MESSAGES[(eventId - 1) % CHAT_MESSAGES.length];

  return {
    id: String(eventId),
    event: "message",
    payload: {
      id: String(eventId),
      author: message.author,
      text: message.text,
      timestamp: new Date().toISOString()
    }
  };
}

function createProgressEvent(progress: number): SSEEvent {
  return {
    event: "progress",
    payload: {
      value: progress,
      label: progress === 100 ? "Conversation complete" : "Processing stream"
    }
  };
}

function createDoneEvent(): SSEEvent {
  return {
    event: "done",
    payload: {
      chatId: CHAT_ID,
      summary: "The demo stream delivered messages, progress updates, and a final event."
    }
  };
}

function writeEvent(response: ServerResponse, event: SSEEvent): void {
  if (event.id) response.write(`id: ${event.id}\n`);
  if (event.retry !== undefined) response.write(`retry: ${event.retry}\n`);
  response.write(`event: ${event.event}\n`);
  response.write(`data: ${JSON.stringify(event.payload)}\n\n`);
}
