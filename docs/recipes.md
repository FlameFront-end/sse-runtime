# Recipes

## Server implementation

Every SSE endpoint must send these headers:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

For cross-origin requests also include the appropriate `Access-Control-Allow-Origin` header.

### Express / Node HTTP

```ts
import express from "express";

const app = express();

app.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let eventId = 0;

  // Send a heartbeat comment every 20 s to keep the connection alive
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 20_000);

  // Send events
  const interval = setInterval(() => {
    eventId += 1;
    res.write(`id: ${eventId}\n`);
    res.write(`retry: 3000\n`);
    res.write(`event: message\n`);
    res.write(`data: ${JSON.stringify({ text: "hello" })}\n\n`);
  }, 1000);

  // Clean up when the client disconnects
  req.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(interval);
  });
});
```

### Hono

```ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const app = new Hono();

app.get("/stream", (c) => {
  return streamSSE(c, async (stream) => {
    let eventId = 0;

    while (true) {
      eventId += 1;
      await stream.writeSSE({
        id: String(eventId),
        event: "message",
        data: JSON.stringify({ text: "hello" }),
        retry: 3000
      });
      await stream.sleep(1000);
    }
  });
});
```

### Fastify

```ts
import Fastify from "fastify";

const app = Fastify();

app.get("/stream", (req, reply) => {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.flushHeaders();

  let eventId = 0;

  const heartbeat = setInterval(() => {
    reply.raw.write(": heartbeat\n\n");
  }, 20_000);

  const interval = setInterval(() => {
    eventId += 1;
    reply.raw.write(`id: ${eventId}\n`);
    reply.raw.write(`event: message\n`);
    reply.raw.write(`data: ${JSON.stringify({ text: "hello" })}\n\n`);
  }, 1000);

  req.raw.on("close", () => {
    clearInterval(heartbeat);
    clearInterval(interval);
  });
});
```

### Next.js route handler

```ts
// app/api/stream/route.ts
export async function GET() {
  const encoder = new TextEncoder();
  let eventId = 0;

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        eventId += 1;
        const chunk =
          `id: ${eventId}\n` +
          `event: message\n` +
          `data: ${JSON.stringify({ text: "hello" })}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      }, 1000);

      // Next.js does not expose a close event here;
      // use AbortSignal from the request context if needed.
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 60_000);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    }
  });
}
```

---

## Client-side recipes

### Reconnect with custom backoff

```ts
createSSEClient({
  key: ["chat"],
  url: "/stream",
  reconnect: {
    enabled: true,
    maxRetries: 10,
    minDelay: 500,
    maxDelay: 15_000
  }
});
```

Delay grows exponentially with jitter between `minDelay` and `maxDelay`. The server's `retry:` field overrides `minDelay` for the next attempt.

### Auth refresh on 401

```ts
createSSEClient({
  key: ["chat"],
  url: "/stream",
  headers: () => ({ Authorization: `Bearer ${getAccessToken()}` }),
  auth: {
    onUnauthorized: async () => {
      await refreshAccessToken();
    },
    retryAfterRefresh: true
  }
});
```

`onUnauthorized` is called once per session. If `retryAfterRefresh` is `true`, the client reconnects after the callback resolves. If the reconnected request returns 401 again, the client moves to `"error"` state.

### Heartbeat timeout

```ts
createSSEClient({
  key: ["chat"],
  url: "/stream",
  heartbeat: {
    timeout: 45_000 // reconnect if silent for 45 s
  }
});
```

Pair with server-side heartbeat comments (`: heartbeat\n\n`) sent every 20–30 s.

### Single-tab coordination

```ts
createSSEClient({
  key: ["chat", roomId],
  url: `/rooms/${roomId}/stream`,
  coordination: {
    enabled: true,
    mode: "single-tab"
  }
});
```

All tabs with the same `key` share one connection. The first tab to call `connect()` becomes the leader and opens the stream. Other tabs follow, receiving events via `BroadcastChannel`. When the leader tab closes, a follower takes over automatically.

### Diagnostics / observability

```ts
createSSEClient({
  key: ["chat"],
  url: "/stream",
  diagnostics: {
    onAttempt: ({ attempt, url }) => {
      console.log(`[SSE] connecting to ${url} (attempt ${attempt})`);
    },
    onReconnectScheduled: ({ attempt, delay, error }) => {
      console.warn(`[SSE] reconnect #${attempt} in ${delay}ms after:`, error.message);
    },
    onAuthRefresh: ({ error }) => {
      console.log("[SSE] refreshing auth after", error.status);
    },
    onCoordinationRoleChange: ({ role }) => {
      console.log(`[SSE] tab is now ${role}`);
    }
  }
});
```

Errors thrown inside diagnostic callbacks are silently ignored and do not affect the stream.

### Runtime event subscription

```ts
const client = createSSEClient<MyEvents>({ key: ["feed"], url: "/stream" });
await client.connect();

// Subscribe to events without recreating the client
const unsubscribe = client.subscribeEvent("message", (payload) => {
  console.log(payload);
});

// Unsubscribe later
unsubscribe();
```

Multiple subscribers for the same event are all called in registration order. Errors in one subscriber do not prevent others from running.
