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

### Waiting for connection readiness

Use `ensureOpen` when you need the stream to be active before performing an action (e.g. sending a command that the server processes over the stream):

```ts
const client = createSSEClient({ key: ["chat"], url: "/stream" });
await client.connect();

async function sendCommand(payload: unknown) {
  const isOpen = await client.ensureOpen({ timeout: 30_000 });
  if (!isOpen) throw new Error("Connection could not be established");
  await fetch("/api/command", { method: "POST", body: JSON.stringify(payload) });
}
```

`ensureOpen` is idempotent — calling it while already open resolves immediately. Multiple concurrent callers all share the same wait and receive the same result.

### Open timeout

Abort the HTTP connection attempt if the server does not respond within a time limit:

```ts
createSSEClient({
  key: ["chat"],
  url: "/stream",
  openTimeout: 30_000 // abort if the response header is not received within 30 s
});
```

The timeout covers the period from request start through accepted SSE response. It does not apply to the stream body once the connection is open. An aborted attempt is treated like any other transport error and triggers a reconnect if `reconnect.enabled` is `true`.

### Custom retry policy

By default all errors are retried up to `reconnect.maxRetries` (default: unlimited). Use `retry` to override which errors trigger a reconnect and how long to wait:

```ts
createSSEClient({
  key: ["chat"],
  url: "/stream",
  reconnect: { maxRetries: 10 },
  retry: {
    shouldRetry: (error) => {
      if (error.status === 401 || error.status === 403) return false; // auth errors are terminal
      if (error.status === 429) return true; // always retry rate-limit
      if (error.status !== undefined && error.status >= 400 && error.status < 500) return false;
      return true;
    },
    getDelay: (ctx) => {
      if (ctx.error.status === 429) return 10_000; // fixed delay for rate-limit
      return ctx.serverRetry ?? 5_000; // honor server retry or fall back
    }
  }
});
```

`reconnect.maxRetries` is always a hard cap. `shouldRetry` is an additional per-error filter applied within that cap — not a way to exceed it.

Errors without an HTTP `status` are network/transport failures (`error.kind === "transport"`). Their original browser error is preserved on `error.cause`, and `error.message` carries the text — classify them by inspecting either:

```ts
retry: {
  shouldRetry: (error) => {
    const text = error.message.toLowerCase();
    if (text.includes("cors")) return false; // misconfiguration — retrying won't help
    return true; // network blips, protocol errors, etc. are transient
  },
  getDelay: (ctx) => {
    if (ctx.error.message.toLowerCase().includes("http2")) return 10_000; // back off harder on protocol errors
    return ctx.serverRetry ?? 5_000;
  }
}
```

### Lifecycle resume & stale-stream watchdog

A connection can break without surfacing an error: the stream goes silent, or the OS kills the socket while the device sleeps. `attachLifecycleResume` recovers from both — browser lifecycle signals plus an optional background watchdog:

```ts
import { attachLifecycleResume } from "@flamefrontend/sse-runtime-core";

const client = createSSEClient({ key: ["chat"], url: "/stream" });
await client.connect();

const detach = attachLifecycleResume(client, {
  staleTimeoutMs: 120_000, // no event for 2 min while "open" → reconnect
  wakeDriftMs: 60_000, // watchdog tick this late → device woke, force reconnect
  minHiddenMs: 15_000 // ignore the visible trigger after a quick tab switch
});

// later: detach();
```

Staleness is measured against `client.getLastEventAt()` by default. If you aggregate events elsewhere (e.g. across several clients), point `getLastActivityAt` at your own source. The watchdog only runs when `staleTimeoutMs` or `wakeDriftMs` is set; with neither, the helper just reacts to lifecycle events as before.

### Diagnostics / observability

```ts
createSSEClient({
  key: ["chat"],
  url: "/stream",
  diagnostics: {
    onAttempt: ({ attempt, url }) => {
      console.log(`[SSE] connecting to ${url} (attempt ${attempt})`);
    },
    onOpen: ({ url }) => {
      console.log(`[SSE] open: ${url}`);
    },
    onDisconnect: ({ url, reason }) => {
      console.log(`[SSE] disconnected (${reason}): ${url}`);
    },
    onReconnectScheduled: ({ attempt, delay, error }) => {
      console.warn(`[SSE] reconnect #${attempt} in ${delay}ms after:`, error.message);
    },
    onAuthRefresh: ({ error }) => {
      console.log("[SSE] refreshing auth after", error.status);
    },
    onCoordinationRoleChange: ({ role }) => {
      console.log(`[SSE] tab is now ${role}`);
    },
    onRawEvent: ({ event, data, id, timestamp }) => {
      console.debug(`[SSE] event "${event}" id=${id ?? "-"} at ${timestamp}`, data);
    },
    onParseError: ({ error, eventName }) => {
      console.error(`[SSE] parse error for "${eventName}":`, error);
    }
  }
});
```

All callbacks are non-critical — errors thrown inside them are silently ignored and do not affect the stream.

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

To observe every event regardless of name — for logging, devtools, or dispatching on a `type` field inside the payload — use `subscribeAnyEvent`. Each envelope carries the parsed `data` plus the original `raw` string:

```ts
client.subscribeAnyEvent(({ type, data, raw }) => {
  log.push({ type, data, raw }); // `raw` is the unparsed `data` line, ideal for logs
});
```
