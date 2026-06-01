# @flamefrontend/sse-runtime-core

Framework-agnostic TypeScript runtime for Server-Sent Events clients.

It provides typed event dispatch, reconnects with jittered backoff,
`Last-Event-ID` resumption, auth refresh on `401`, connection status, cleanup,
and optional single-tab coordination across browser tabs.

## Install

```bash
pnpm add @flamefrontend/sse-runtime-core
```

## Quick Start

```ts
import { createSSEClient } from "@flamefrontend/sse-runtime-core";

type Events = {
  message: {
    id: string;
    text: string;
  };
};

const client = createSSEClient<Events>({
  key: ["chat", "123"],
  url: "/api/chats/123/stream",
  events: {
    message: (message) => {
      console.log(message.text);
    }
  }
});

await client.connect();
client.disconnect();
```

## Event Format

```txt
id: 42
event: message
data: {"id":"42","text":"hello"}

```

JSON `data:` payloads are parsed before dispatch. Invalid JSON is delivered as
the raw string payload.

## Client API

- `connect(): Promise<void>`
- `disconnect(): void`
- `ensureOpen(options?: { timeout?: number }): Promise<boolean>` — wait until the stream is open; starts connecting if needed
- `getStatus(): SSEConnectionStatus`
- `getError(): SSEError | null`
- `subscribeStatus(listener): () => void`
- `subscribeError(listener): () => void`
- `subscribeEvent(eventName, handler): () => void`
- `subscribeAnyEvent(handler): () => void`

## Core Options

- `key`: stable stream identity, for example `["chat", chatId]`.
- `url`: SSE endpoint URL.
- `enabled`: set to `false` to start idle.
- `headers`: static or async headers, resolved before each connection attempt.
- `credentials`: passed to `fetch`, for example `"include"`.
- `events`: typed event handlers registered at creation time.
- `reconnect`: backoff and retry limits.
- `auth`: `401` refresh callback.
- `coordination`: optional single-tab coordination.
- `heartbeat`: reconnect when the stream is silent for too long.
- `openTimeout`: abort the connection attempt if the server does not respond within this many ms.
- `retry`: custom per-error `shouldRetry` predicate and `getDelay` function.
- `diagnostics`: structured observability callbacks (`onOpen`, `onDisconnect`, `onRawEvent`, etc.).

## Reconnect And Resumption

Reconnect is enabled by default. The runtime uses jittered exponential backoff,
honors server `retry` fields, and stops reconnecting after manual
`disconnect()`.

When events include `id`, the latest id is sent as `Last-Event-ID` on reconnect.

## Auth Refresh

```ts
const client = createSSEClient<Events>({
  key: ["chat", chatId],
  url: `/api/chats/${chatId}/stream`,
  headers: async () => ({
    Authorization: `Bearer ${await getAccessToken()}`
  }),
  auth: {
    onUnauthorized: refreshAccessToken,
    retryAfterRefresh: true
  }
});
```

## Single-Tab Coordination

```ts
const client = createSSEClient<Events>({
  key: ["chat", chatId],
  url: `/api/chats/${chatId}/stream`,
  coordination: {
    enabled: true,
    mode: "single-tab"
  }
});
```

Tabs with the same `key` elect one leader through Web Locks. The leader owns the
SSE connection and forwards events/status/errors through `BroadcastChannel`.
When the leader goes away, a follower is promoted and resumes the stream from the
last seen `Last-Event-ID`. Unsupported environments fall back to independent
per-tab connections.

### Known Limitations

- A leader that reaches a terminal `error` status (for example after exhausting
  reconnect retries) keeps leadership and does not hand it off, so other tabs
  wait rather than racing to open a fresh connection that would likely fail the
  same way.
- During the leadership handoff there is a sub-millisecond window in which an
  event from the new leader may be delivered ahead of a still-draining event
  from the previous leader. The window is bounded by microtask timing and does
  not affect steady-state ordering.

## More Documentation

Full guide: https://github.com/FlameFront-end/sse-runtime#readme

## License

MIT
