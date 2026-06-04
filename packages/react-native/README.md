# @flamefrontend/sse-runtime-react-native

React Native hooks and lifecycle helpers for production Server-Sent Events clients.

This package wraps `@flamefrontend/sse-runtime-core` for React Native apps. It
keeps the React hook API close to `@flamefrontend/sse-runtime-react`, but exposes
runtime dependencies explicitly so apps can provide the transport and text
decoder that match their React Native runtime.

## Install

```bash
npm install @flamefrontend/sse-runtime-react-native
```

> Works with any package manager - swap `npm install` for `pnpm add` or
> `yarn add`. Requires `react >= 18` and a streaming SSE transport compatible
> with `@flamefrontend/sse-runtime-core`. React Native is supplied by the app;
> this package does not import it directly.

## Quick Start

```tsx
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import {
  attachReactNativeLifecycleResume,
  useReactNativeSSE
} from "@flamefrontend/sse-runtime-react-native";

type ChatEvents = {
  message: {
    id: string;
    text: string;
  };
};

export function ChatStream({ chatId }: { chatId: string }) {
  const connection = useReactNativeSSE<ChatEvents>({
    key: ["chat", chatId],
    url: `https://example.com/api/chats/${chatId}/stream`,
    enabled: Boolean(chatId),
    events: {
      message: (message) => {
        console.log(message.text);
      }
    }
  });

  useEffect(() => {
    return attachReactNativeLifecycleResume(connection.client, {
      appState: AppState,
      netInfo: NetInfo,
      staleTimeoutMs: 60_000
    });
  }, [connection.client]);

  return null;
}
```

## Transport Compatibility

React Native networking support differs by version, platform, runtime, and
polyfills. The default core transport uses `fetch`, `Response.body`,
`ReadableStream`, and `TextDecoder`. If your app runtime does not provide a
compatible streaming response body, pass a custom core `transport` and
`createTextDecoder` through the second `useReactNativeSSE` argument.

```tsx
const connection = useReactNativeSSE(
  {
    key: ["chat"],
    url: "https://example.com/api/chat/stream"
  },
  {
    transport: createReactNativeSSETransport(),
    createTextDecoder: () => new TextDecoder()
  }
);
```

## Shared Client

```tsx
import {
  ReactNativeSSEProvider,
  useReactNativeSSEContext
} from "@flamefrontend/sse-runtime-react-native";

function App() {
  return (
    <ReactNativeSSEProvider options={{ key: ["chat"], url: "https://example.com/stream" }}>
      <ConnectionConsumer />
    </ReactNativeSSEProvider>
  );
}

function ConnectionConsumer() {
  const client = useReactNativeSSEContext<ChatEvents>();
  return null;
}
```

## Lifecycle Resume

`attachReactNativeLifecycleResume` resumes the stream when:

- `AppState` changes back to `active`
- optional NetInfo reports `isConnected: true`
- optional stale or wake-drift watchdog detects a stale stream

NetInfo is intentionally not a peer dependency. Pass any object with a compatible
`addEventListener(listener)` method.

## License

MIT
