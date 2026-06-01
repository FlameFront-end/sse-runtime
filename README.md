# sse-runtime

TypeScript runtime for production Server-Sent Events clients.

`sse-runtime` handles the client-side work around long-lived SSE streams:
typed event dispatch, reconnects, auth refresh on `401`, `Last-Event-ID`
resumption, connection status, cleanup, and optional single-tab coordination
across browser tabs.

## Packages

| Package                            | Purpose                                   |
| ---------------------------------- | ----------------------------------------- |
| `@flamefrontend/sse-runtime-core`  | Framework-agnostic SSE runtime.           |
| `@flamefrontend/sse-runtime-react` | React `useSSE` hook built on top of core. |

## Install

For React applications:

```bash
pnpm add @flamefrontend/sse-runtime-react
```

For framework-agnostic usage:

```bash
pnpm add @flamefrontend/sse-runtime-core
```

## Quick Start

```tsx
import { useSSE } from "@flamefrontend/sse-runtime-react";

type ChatEvents = {
  message: {
    id: string;
    text: string;
  };
  progress: {
    value: number;
  };
  done: {
    chatId: string;
  };
};

export function ChatStream({ chatId, token }: { chatId: string; token: string }) {
  const connection = useSSE<ChatEvents>({
    key: ["chat", chatId],
    url: `/api/chats/${chatId}/stream`,
    enabled: Boolean(chatId),
    headers: {
      Authorization: `Bearer ${token}`
    },
    events: {
      message: (message) => {
        console.log(message.text);
      },
      progress: (progress) => {
        console.log(progress.value);
      },
      done: (done) => {
        console.log(done.chatId);
      }
    }
  });

  return (
    <section>
      <p>Status: {connection.status}</p>
      {connection.error ? <p>Error: {connection.error.message}</p> : null}
      <button type="button" onClick={() => void connection.connect()}>
        Connect
      </button>
      <button type="button" onClick={connection.disconnect}>
        Disconnect
      </button>
    </section>
  );
}
```

## Server Event Format

Event payloads are read from standard SSE `data:` fields. JSON payloads are
parsed before dispatch; if parsing fails, the raw string is passed to the
handler.

```txt
id: 42
event: message
data: {"id":"42","text":"hello"}

```

The runtime also reads:

- `id` for `Last-Event-ID` resumption on reconnect.
- `retry` as the server-suggested base reconnect delay.

## React API

### `useSSE(options)`

Creates an SSE client, subscribes React state to its status/error updates, and
connects automatically unless `enabled` is `false`.

```ts
const connection = useSSE<Events>({
  key,
  url,
  enabled,
  headers,
  credentials,
  events,
  reconnect,
  auth,
  coordination
});
```

Returns:

```ts
type UseSSEResult = {
  readonly status: SSEConnectionStatus;
  readonly error: SSEError | null;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
};
```

The hook disconnects during unmount. Event handlers, headers, reconnect options,
and auth handlers can change between renders without recreating the client. The
client is recreated when transport-level identity changes, such as `key`, `url`,
`enabled`, `credentials`, event names, or coordination options.

## Core API

```ts
import { createSSEClient } from "@flamefrontend/sse-runtime-core";

type Events = {
  message: {
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

Client methods:

- `connect(): Promise<void>`
- `disconnect(): void`
- `getStatus(): SSEConnectionStatus`
- `getError(): SSEError | null`
- `subscribeStatus(listener): () => void`
- `subscribeError(listener): () => void`

## Options

```ts
type SSEClientOptions<Events extends EventMap> = {
  readonly key: readonly string[];
  readonly url: string;
  readonly enabled?: boolean;
  readonly headers?:
    | Record<string, string>
    | (() => Promise<Record<string, string>> | Record<string, string>);
  readonly credentials?: RequestCredentials;
  readonly events?: Partial<{
    readonly [EventName in keyof Events]: EventHandler<Events[EventName]>;
  }>;
  readonly reconnect?: ReconnectOptions;
  readonly auth?: AuthOptions;
  readonly coordination?: CoordinationOptions;
};
```

### `key`

Stable logical stream identity. It is used by React memoization and by
single-tab coordination. Use values that uniquely identify the stream, such as
`["chat", chatId]`.

### `headers`

Static or async request headers. Async headers are resolved before each
connection attempt, including reconnects and auth refresh retries.

### `credentials`

Passed to `fetch` as `RequestCredentials`. Use `"include"` for cross-origin
cookie authentication.

## Reconnect

Reconnect is enabled by default. The runtime uses jittered exponential backoff
and stops reconnecting after manual `disconnect()`.

```ts
useSSE<Events>({
  key: ["chat", chatId],
  url: `/api/chats/${chatId}/stream`,
  reconnect: {
    enabled: true,
    maxRetries: 10,
    minDelay: 1000,
    maxDelay: 30000
  }
});
```

If the server sends `retry: 5000`, that value becomes the base delay for the
next reconnect.

## Auth Refresh

When the server returns `401`, the runtime can call `auth.onUnauthorized`, wait
for it to finish, and retry the connection once.

```ts
useSSE<Events>({
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

If refresh fails or `retryAfterRefresh` is `false`, the connection moves to
`error`.

## Resumption

When events include an `id`, the runtime stores the latest id and sends it as
`Last-Event-ID` on reconnect. A compliant server can use that header to resume
the stream without replaying already-handled events.

## Single-Tab Coordination

Multiple tabs can share one physical SSE connection. Tabs with the same `key`
elect one leader with the Web Locks API. The leader opens the SSE stream and
broadcasts events, status changes, and errors to follower tabs through
`BroadcastChannel`.

```ts
useSSE<Events>({
  key: ["chat", chatId],
  url: `/api/chats/${chatId}/stream`,
  coordination: {
    enabled: true,
    mode: "single-tab"
  }
});
```

If `BroadcastChannel` or Web Locks are unavailable, the runtime falls back to an
independent per-tab connection.

## Status And Errors

```ts
type SSEConnectionStatus = "idle" | "connecting" | "open" | "reconnecting" | "error" | "closed";
```

```ts
type SSEError = {
  readonly kind: "auth" | "handler" | "transport";
  readonly message: string;
  readonly status?: number;
  readonly cause?: unknown;
};
```

Error kinds:

- `transport`: request, response, stream, or reconnect failure.
- `auth`: auth refresh failure.
- `handler`: event handler threw or rejected.

## Browser Support

The default transport uses `fetch`, `ReadableStream`, `AbortController`, and
`TextDecoder`. Single-tab coordination additionally uses `BroadcastChannel` and
the Web Locks API, with automatic fallback when those APIs are missing.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
```

Run the demo app:

```bash
pnpm dev
```

Check npm package contents without publishing:

```bash
pnpm publish:dry-run
```

Publish both packages:

```bash
pnpm publish:packages
```

## Repository Layout

```txt
packages/
  core/
    src/
      auth/
      client/
      coordination/
      errors/
      events/
      keys/
      parser/
      reconnect/
      timing/
      transport/
      types/
  react/
    src/
      hooks/
      types/
examples/
  react-chat-demo/
docs/
```

## License

MIT
