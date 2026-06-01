# @flamefrontend/sse-runtime-react

React hooks for production Server-Sent Events clients.

This package wraps `@flamefrontend/sse-runtime-core` with a `useSSE` hook that
connects on mount, disconnects on unmount, exposes status/error state, and keeps
event handlers and dynamic options fresh across renders. An `SSEProvider` plus
the `useSSEContext`, `useSSEEvent`, and `useSSEStatus` hooks let multiple
components share a single stream.

## Install

```bash
npm install @flamefrontend/sse-runtime-react
```

> Works with any package manager — swap `npm install` for `pnpm add` or `yarn add`.
> `@flamefrontend/sse-runtime-core` is pulled in automatically; install it
> explicitly only if you import from it directly. Requires `react ≥ 18`.

## Quick Start

```tsx
import { useSSE } from "@flamefrontend/sse-runtime-react";

type ChatEvents = {
  message: {
    id: string;
    text: string;
  };
  done: {
    chatId: string;
  };
};

export function ChatStream({ chatId }: { chatId: string }) {
  const connection = useSSE<ChatEvents>({
    key: ["chat", chatId],
    url: `/api/chats/${chatId}/stream`,
    enabled: Boolean(chatId),
    events: {
      message: (message) => {
        console.log(message.text);
      },
      done: (done) => {
        console.log(done.chatId);
      }
    }
  });

  return (
    <section>
      <p>Status: {connection.status}</p>
      {connection.error ? <p>{connection.error.message}</p> : null}
    </section>
  );
}
```

## API

`useSSE` accepts the full core `SSEClientOptions` — `key`, `url`, `enabled`,
`headers`, `credentials`, `events`, `reconnect`, `auth`, `coordination`,
`heartbeat`, and `diagnostics`.

`enabled` controls auto-connect: when `false`, the hook does not open the stream
on mount, but the returned `connect()` still opens it on demand (like `enabled`
in React Query), and `disconnect()` closes it.

```ts
const connection = useSSE<Events>({ key, url, events });
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

## Dynamic Options

`useSSE` keeps these values fresh without recreating the client:

- `headers`
- `events`
- `reconnect`
- `auth`

The client is recreated when transport-level identity changes:

- `key`
- `url`
- `enabled`
- `credentials`
- event names
- `coordination`

## Sharing One Stream Across Components

`useSSE` owns a client for a single component. To share one stream across a
subtree, use `SSEProvider` and read it with the helper hooks.

```tsx
import {
  SSEProvider,
  useSSEContext,
  useSSEEvent,
  useSSEStatus
} from "@flamefrontend/sse-runtime-react";

function App() {
  return (
    <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/api/chat/stream" }}>
      <MessageList />
      <ConnectionBadge />
    </SSEProvider>
  );
}

function MessageList() {
  const client = useSSEContext<ChatEvents>();
  useSSEEvent(client, "message", (message) => {
    console.log(message.text);
  });
  return null;
}

function ConnectionBadge() {
  const client = useSSEContext<ChatEvents>();
  const { status, error } = useSSEStatus(client);
  return <span>{error ? error.message : status}</span>;
}
```

- **`SSEProvider`** — owns the client lifecycle (connect on mount, disconnect on
  unmount) and provides it via context. Same recreation rules as `useSSE`.
- **`useSSEContext()`** — returns the nearest provider's client; throws if used
  outside an `SSEProvider`.
- **`useSSEEvent(client, name, handler)`** — subscribes to a named event; the
  handler is kept in a ref and unsubscribes on unmount or when `name` changes.
- **`useSSEStatus(client)`** — returns `{ status, error }` for components that
  only display connection state.

## Devtools

Wrap your tree once with `SSEDevtoolsProvider` from
[`@flamefrontend/sse-runtime-devtools`](../devtools) and every `useSSE` and
`SSEProvider` inside registers automatically — no manual wiring.

## Auth Refresh

```tsx
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

## Single-Tab Coordination

```tsx
useSSE<Events>({
  key: ["chat", chatId],
  url: `/api/chats/${chatId}/stream`,
  coordination: {
    enabled: true,
    mode: "single-tab"
  }
});
```

Tabs with the same `key` share one physical SSE connection when
`BroadcastChannel` and Web Locks are available.

## More Documentation

Full guide: https://github.com/FlameFront-end/sse-runtime#readme

## License

MIT
