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
- `getStatus(): SSEConnectionStatus`
- `getError(): SSEError | null`
- `subscribeStatus(listener): () => void`
- `subscribeError(listener): () => void`

## Core Options

- `key`: stable stream identity, for example `["chat", chatId]`.
- `url`: SSE endpoint URL.
- `enabled`: set to `false` to start idle.
- `headers`: static or async headers, resolved before each connection attempt.
- `credentials`: passed to `fetch`, for example `"include"`.
- `events`: typed event handlers.
- `reconnect`: backoff and retry limits.
- `auth`: `401` refresh callback.
- `coordination`: optional single-tab coordination.

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
Unsupported environments fall back to independent per-tab connections.

## More Documentation

Full guide: https://github.com/FlameFront-end/sse-runtime#readme

## License

MIT
