# Getting started

## Installation

```bash
# Core only (framework-agnostic)
npm install @flamefrontend/sse-runtime-core

# React integration
npm install @flamefrontend/sse-runtime-core @flamefrontend/sse-runtime-react
```

## Quick start — React

```tsx
import { useSSE } from "@flamefrontend/sse-runtime-react";

type ChatEvents = {
  message: { text: string; author: string };
  ping: void;
};

function Chat() {
  const { status, error } = useSSE<ChatEvents>({
    key: ["chat"],
    url: "/api/chat/stream",
    events: {
      message: (payload) => {
        console.log(payload.text);
      }
    }
  });

  return <div>Status: {status}</div>;
}
```

## Quick start — Core (no framework)

```ts
import { createSSEClient } from "@flamefrontend/sse-runtime-core";

type ChatEvents = {
  message: { text: string };
};

const client = createSSEClient<ChatEvents>({
  key: ["chat"],
  url: "/api/chat/stream",
  events: {
    message: (payload) => console.log(payload.text)
  }
});

await client.connect();

// Later:
client.disconnect();
```

## Provider pattern (React)

Use `SSEProvider` when multiple components need access to the same stream:

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
  useSSEEvent(client, "message", (payload) => {
    setMessages((prev) => [...prev, payload]);
  });
  return <ul>{/* messages */}</ul>;
}

function ConnectionBadge() {
  const client = useSSEContext<ChatEvents>();
  const { status } = useSSEStatus(client);
  return <span>{status}</span>;
}
```

## Devtools (optional)

Wrap your app once with `SSEDevtoolsProvider` to get a floating panel that lists
every active connection, its status, byte-level activity, recovery state, and a live
event log. It also warns about `Open / silent` connections when no transport activity
arrives for the configured threshold. Each `useSSE` call and `SSEProvider` inside the
tree registers automatically — no manual wiring.

```bash
npm install @flamefrontend/sse-runtime-devtools
```

```tsx
import { SSEDevtoolsProvider } from "@flamefrontend/sse-runtime-devtools";

createRoot(document.getElementById("root")).render(
  <SSEDevtoolsProvider enabled={import.meta.env.DEV}>
    <App />
  </SSEDevtoolsProvider>
);
```

Pass `enabled={false}` in production — the provider then renders only its
children with no registry, UI, or overhead. See the
[devtools README](../packages/devtools/README.md) for all props.

## Minimal server (Node.js)

```ts
import http from "node:http";

http
  .createServer((req, res) => {
    if (req.url !== "/stream") return res.end();

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    const interval = setInterval(() => {
      res.write(`event: message\ndata: ${JSON.stringify({ text: "hello" })}\n\n`);
    }, 1000);

    req.on("close", () => clearInterval(interval));
  })
  .listen(3000);
```
