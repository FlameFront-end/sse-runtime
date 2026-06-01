# sse-runtime

**Production-grade Server-Sent Events for the browser — typed, resilient, and tab-aware.**

The native `EventSource` can't send an `Authorization` header, gives you untyped
`message` blobs, reconnects with no control, and opens a fresh connection in
every tab. `sse-runtime` replaces it with a `fetch`-based client that handles the
hard parts of long-lived SSE streams so your app code stays small.

```ts
// Native EventSource — no headers, no types, one connection per tab
const es = new EventSource("/api/chats/123/stream");
es.onmessage = (e) => console.log(JSON.parse(e.data)); // any

// sse-runtime — auth headers, typed events, shared across tabs
const client = createSSEClient<ChatEvents>({
  key: ["chat", "123"],
  url: "/api/chats/123/stream",
  headers: { Authorization: `Bearer ${token}` },
  events: { message: (m) => console.log(m.text) }, // typed
  coordination: { enabled: true, mode: "single-tab" }
});
```

## Features

- **Typed events** — declare an event map once; handlers and payloads are fully inferred.
- **Auth that works** — static or async `headers`, plus a `401` refresh-and-retry hook.
- **Resilient reconnects** — jittered exponential backoff, `maxRetries` cap, honors server `retry:` field.
- **Custom retry policy** — `shouldRetry` predicate and `getDelay` for per-error classification (e.g. terminal 4xx, special handling for 429).
- **Open timeout** — abort the HTTP connection attempt if the server takes too long to respond.
- **Connection readiness** — `ensureOpen({ timeout })` resolves when the stream is ready; safe to call before any action that depends on an active connection.
- **Seamless resumption** — tracks `Last-Event-ID` and resumes the stream on reconnect.
- **Single-tab coordination** — one real connection per browser, shared to every tab via Web Locks + `BroadcastChannel`, with transparent failover.
- **Observable state** — `idle / connecting / open / reconnecting / error / closed` plus structured errors.
- **Rich diagnostics** — `onOpen`, `onDisconnect`, `onRawEvent`, `onParseError`, and more for logging and debugging.
- **Devtools** — drop-in panel to inspect live connections, event logs, and status while developing.
- **Zero runtime dependencies** — framework-agnostic core; a thin React hook on top.

## Packages

| Package                                                    | Description                                           |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| [`@flamefrontend/sse-runtime-core`](packages/core)         | Framework-agnostic SSE runtime.                       |
| [`@flamefrontend/sse-runtime-react`](packages/react)       | `useSSE` hook built on top of core.                   |
| [`@flamefrontend/sse-runtime-devtools`](packages/devtools) | Devtools panel to inspect connections, events, state. |

## Install

```bash
# React hook
npm install @flamefrontend/sse-runtime-react

# Framework-agnostic core
npm install @flamefrontend/sse-runtime-core

# Devtools panel (optional, dev only)
npm install @flamefrontend/sse-runtime-devtools
```

> Works with any package manager — swap `npm install` for `pnpm add` or `yarn add`.

## Quick Start (React)

```tsx
import { useSSE } from "@flamefrontend/sse-runtime-react";

type ChatEvents = {
  message: { id: string; text: string };
  done: { chatId: string };
};

export function ChatStream({ chatId, token }: { chatId: string; token: string }) {
  const connection = useSSE<ChatEvents>({
    key: ["chat", chatId],
    url: `/api/chats/${chatId}/stream`,
    enabled: Boolean(chatId),
    headers: { Authorization: `Bearer ${token}` },
    events: {
      message: (message) => console.log(message.text),
      done: (done) => console.log(done.chatId)
    }
  });

  return (
    <section>
      <p>Status: {connection.status}</p>
      {connection.error ? <p>Error: {connection.error.message}</p> : null}
    </section>
  );
}
```

The hook connects on mount, disconnects on unmount, and keeps event handlers and
dynamic options fresh across renders without tearing down the connection.

## Documentation

- [Getting Started](docs/getting-started.md) — install, first stream, server format.
- [API Reference](docs/api-reference.md) — every option, method, and type.
- [Recipes](docs/recipes.md) — auth refresh, resumption, multi-tab coordination.
- [Troubleshooting](docs/troubleshooting.md) — common pitfalls and fixes.
- Package guides: [core](packages/core/README.md) · [react](packages/react/README.md) · [devtools](packages/devtools/README.md)

## Browser Support

The default transport uses `fetch`, `ReadableStream`, `AbortController`, and
`TextDecoder`. Single-tab coordination additionally uses `BroadcastChannel` and
the Web Locks API, falling back to an independent per-tab connection when either
is unavailable.

## Development

```bash
pnpm install        # install workspace dependencies
pnpm build          # build all packages
pnpm -r typecheck   # typecheck every package
pnpm test           # run the test suite
pnpm lint           # eslint
pnpm dev            # run the react-chat-demo
```

## License

MIT
