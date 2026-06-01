# API reference

## Core — `@flamefrontend/sse-runtime-core`

### `createSSEClient<Events>(options, dependencies?)`

Creates an SSE client. Returns an `SSEClient<Events>` object.

```ts
const client = createSSEClient<MyEvents>({
  key: ["chat"],
  url: "/api/stream"
});
```

#### `SSEClientOptions<Events>`

| Field          | Type                                                                                        | Default  | Description                                             |
| -------------- | ------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- |
| `key`          | `readonly string[]`                                                                         | required | Stable identity for coordination and deduplication      |
| `url`          | `string`                                                                                    | required | SSE endpoint URL                                        |
| `enabled`      | `boolean`                                                                                   | `true`   | Set to `false` to start in idle state (no auto-connect) |
| `headers`      | `Record<string, string> \| () => Record<string, string> \| Promise<Record<string, string>>` | —        | Static or dynamic request headers                       |
| `credentials`  | `RequestCredentials`                                                                        | —        | Passed to `fetch` as-is                                 |
| `events`       | `Partial<{ [K in keyof Events]: (payload: Events[K]) => void \| Promise<void> }>`           | —        | Static event handlers registered at creation time       |
| `reconnect`    | `ReconnectOptions`                                                                          | —        | Backoff configuration                                   |
| `auth`         | `AuthOptions`                                                                               | —        | 401 handling and token refresh                          |
| `coordination` | `CoordinationOptions`                                                                       | —        | Single-tab deduplication across browser tabs            |
| `heartbeat`    | `HeartbeatOptions`                                                                          | —        | Abort and reconnect when stream goes silent             |
| `diagnostics`  | `DiagnosticsOptions`                                                                        | —        | Structured callbacks for observability                  |
| `retry`        | `RetryPolicyOptions`                                                                        | —        | Per-error retry classification and custom delay         |
| `openTimeout`  | `number`                                                                                    | —        | Max ms to wait for the HTTP response before aborting    |

#### `ReconnectOptions`

| Field        | Type      | Default    | Description                          |
| ------------ | --------- | ---------- | ------------------------------------ |
| `enabled`    | `boolean` | `true`     | Enable automatic reconnection        |
| `maxRetries` | `number`  | `Infinity` | Maximum number of reconnect attempts |
| `minDelay`   | `number`  | `1000`     | Minimum backoff delay in ms          |
| `maxDelay`   | `number`  | `30000`    | Maximum backoff delay in ms          |

#### `RetryPolicyOptions`

Fine-grained control over which errors trigger a reconnect and how long to wait. When provided alongside `reconnect`, `maxRetries` is always enforced as a hard cap first; `shouldRetry` acts as a secondary per-error filter within that cap.

| Field         | Type                            | Description                                                     |
| ------------- | ------------------------------- | --------------------------------------------------------------- |
| `shouldRetry` | `(error: SSEError) => boolean`  | Return `false` to treat this error as terminal, `true` to retry |
| `getDelay`    | `(ctx: RetryContext) => number` | Return the delay in ms for the next attempt                     |

`RetryContext`:

```ts
type RetryContext = {
  attempt: number; // reconnect attempt counter (1-based)
  error: SSEError; // error that triggered the reconnect
  serverRetry?: number; // value from the server's last `retry:` field
};
```

#### `AuthOptions`

| Field               | Type                          | Description                                          |
| ------------------- | ----------------------------- | ---------------------------------------------------- |
| `onUnauthorized`    | `() => void \| Promise<void>` | Called on 401; perform token refresh here            |
| `retryAfterRefresh` | `boolean`                     | Retry the connection after `onUnauthorized` resolves |

#### `CoordinationOptions`

| Field     | Type           | Default        | Description                          |
| --------- | -------------- | -------------- | ------------------------------------ |
| `enabled` | `boolean`      | `false`        | Enable single-tab coordination       |
| `mode`    | `"single-tab"` | `"single-tab"` | Only one mode is currently supported |

When enabled, one tab opens the real SSE connection (the leader) and broadcasts events to all other tabs over a `BroadcastChannel`. Requires `BroadcastChannel` and Web Locks. Falls back to an independent connection if either API is unavailable.

#### `HeartbeatOptions`

| Field     | Type     | Description                                                |
| --------- | -------- | ---------------------------------------------------------- |
| `timeout` | `number` | Abort and reconnect if no bytes arrive within this many ms |

#### `DiagnosticsOptions`

All callbacks are non-critical — errors thrown inside them are silently swallowed and do not affect the stream.

| Field                      | Type                                                                  | Description                                                       |
| -------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `onAttempt`                | `(info: { attempt: number; url: string }) => void`                    | Fires at the start of each connection attempt                     |
| `onOpen`                   | `(info: { url: string }) => void`                                     | Fires when the HTTP response is accepted and the stream starts    |
| `onDisconnect`             | `(info: DisconnectDiagnosticInfo) => void`                            | Fires when the connection closes (see `DisconnectReason` below)   |
| `onReconnectScheduled`     | `(info: { attempt: number; delay: number; error: SSEError }) => void` | Fires when a reconnect is queued after a failure                  |
| `onAuthRefresh`            | `(info: { error: SSEError }) => void`                                 | Fires when a 401 triggers an auth refresh                         |
| `onCoordinationRoleChange` | `(info: { role: "leader" \| "follower" }) => void`                    | Fires when the tab's coordination role changes                    |
| `onRawEvent`               | `(info: RawEventDiagnosticInfo) => void`                              | Fires for every parsed SSE event before handlers run              |
| `onParseError`             | `(info: { error: unknown; eventName: string }) => void`               | Fires when a JSON payload for a named subscriber cannot be parsed |

`DisconnectDiagnosticInfo`:

```ts
type DisconnectDiagnosticInfo = {
  url: string;
  reason: "manual" | "error" | "stream-ended";
};
```

- `"manual"` — `disconnect()` was called explicitly.
- `"error"` — a connection-level failure reached the terminal state (no more retries).
- `"stream-ended"` — the server closed the stream, no more retries scheduled.

`RawEventDiagnosticInfo`:

```ts
type RawEventDiagnosticInfo = {
  event: string; // event name ("message" if omitted by server)
  data: string; // raw data string before JSON parsing
  id: string | undefined;
  retry: number | undefined;
  timestamp: number; // Date.now() at dispatch time
  connectionKey: readonly string[];
};
```

---

### `SSEClient<Events>`

Returned by `createSSEClient`.

| Method              | Signature                                                                                                      | Description                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connect`           | `() => Promise<void>`                                                                                          | Open the connection. Resolves once the HTTP response is accepted. Idempotent — safe to call when already open.                                                   |
| `disconnect`        | `() => void`                                                                                                   | Close the connection and stop all reconnect timers.                                                                                                              |
| `ensureOpen`        | `(options?: { timeout?: number }) => Promise<boolean>`                                                         | Wait until the connection is open. Starts connecting if needed. Resolves `true` when open, `false` on terminal failure, rejects if the optional timeout expires. |
| `getStatus`         | `() => SSEConnectionStatus`                                                                                    | Synchronous status snapshot.                                                                                                                                     |
| `getError`          | `() => SSEError \| null`                                                                                       | Last error, or null.                                                                                                                                             |
| `subscribeStatus`   | `(listener: SSEStatusListener) => () => void`                                                                  | Subscribe to status changes. Returns an unsubscribe function.                                                                                                    |
| `subscribeError`    | `(listener: SSEErrorListener) => () => void`                                                                   | Subscribe to error changes. Returns an unsubscribe function.                                                                                                     |
| `subscribeEvent`    | `<N extends keyof Events>(eventName: N, handler: (payload: Events[N]) => void \| Promise<void>) => () => void` | Subscribe to a named event at runtime. Returns an unsubscribe function.                                                                                          |
| `subscribeAnyEvent` | `(handler: (event: SSEEventEnvelope) => void \| Promise<void>) => () => void`                                  | Observe every event regardless of name. Receives `{ type, data }`; handler errors are swallowed. Returns an unsubscribe function.                                |

#### `SSEConnectionStatus`

```ts
type SSEConnectionStatus = "idle" | "closed" | "connecting" | "open" | "reconnecting" | "error";
```

| Value          | Meaning                                                       |
| -------------- | ------------------------------------------------------------- |
| `idle`         | `enabled: false` — client will not connect automatically      |
| `closed`       | Disconnected, ready to connect                                |
| `connecting`   | Initial connection attempt in progress                        |
| `open`         | Stream is active                                              |
| `reconnecting` | Failed; waiting to retry                                      |
| `error`        | Terminal failure (max retries reached or non-retryable error) |

#### `SSEError`

```ts
type SSEError = {
  kind: SSEErrorKind; // "transport" | "auth" | "handler"
  message: string;
  status?: number; // HTTP status code, set on transport errors from a failed response
  cause?: unknown; // Original exception
};
```

---

### `createSSEParser()` / `parseSSEChunk(chunk)`

Low-level SSE parser. `createSSEParser` returns a stateful parser for streaming input; `parseSSEChunk` is a convenience wrapper for complete chunks.

```ts
const parser = createSSEParser();
parser.parse("event: message\ndata: hello\n\n"); // → [{ event, data, id, retry }]
parser.flush(); // flush any buffered partial event
```

---

## React — `@flamefrontend/sse-runtime-react`

### `useSSE<Events>(options)`

Creates and manages an SSE client for the lifetime of the component. Automatically calls `connect` on mount and `disconnect` on unmount.

```ts
const { status, error, connect, disconnect } = useSSE<Events>(options);
```

Returns `UseSSEResult`:

| Field        | Type                  | Description                                                 |
| ------------ | --------------------- | ----------------------------------------------------------- |
| `status`     | `SSEConnectionStatus` | Current connection status                                   |
| `error`      | `SSEError \| null`    | Last error                                                  |
| `connect`    | `() => Promise<void>` | Manually trigger a connection (e.g. after `enabled: false`) |
| `disconnect` | `() => void`          | Manually disconnect                                         |

The client is recreated only when `key`, `url`, `enabled`, `credentials`, the set of event names, or `coordination` change. Dynamic values like `headers`, event handler functions, `reconnect`, and `auth` are read from a ref — they update without recreating the client.

---

### `SSEProvider<Events>`

Owns the client lifecycle and provides it to child components via React context.

```tsx
<SSEProvider<Events> options={options}>{children}</SSEProvider>
```

Behaves identically to `useSSE` in terms of connect/disconnect lifecycle. Use when multiple components in the tree need access to the same stream.

---

### `useSSEContext<Events>()`

Returns the `SSEClient<Events>` from the nearest `SSEProvider`. Throws if called outside a provider.

```ts
const client = useSSEContext<ChatEvents>();
```

---

### `useSSEEvent<Events, EventName>(connection, eventName, handler)`

Subscribes to a named event. The handler is kept in a ref — it always reflects the latest closure without resubscribing on every render.

```ts
useSSEEvent(client, "message", (payload) => {
  setMessages((prev) => [...prev, payload]);
});
```

Unsubscribes automatically on unmount or when `connection`/`eventName` changes.

---

### `useSSEStatus(connection)`

Returns `{ status, error }` for a connection. Useful for components that only need to display connection state without owning the lifecycle.

```ts
const { status, error } = useSSEStatus(client);
```

Returns `UseSSEStatusResult`:

| Field    | Type                  |
| -------- | --------------------- |
| `status` | `SSEConnectionStatus` |
| `error`  | `SSEError \| null`    |
