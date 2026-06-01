# @flamefrontend/sse-runtime-react

React hook for production Server-Sent Events clients.

This package wraps `@flamefrontend/sse-runtime-core` with a `useSSE` hook that
connects on mount, disconnects on unmount, exposes status/error state, and keeps
event handlers and dynamic options fresh across renders.

## Install

```bash
pnpm add @flamefrontend/sse-runtime-react
```

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
