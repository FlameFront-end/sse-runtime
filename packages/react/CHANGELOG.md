# @flamefrontend/sse-runtime-react

## 0.5.0

### Minor Changes

- 0cbeac0: `useSSE` now returns `client`, `ensureOpen`, and `reconnect` alongside `status`,
  `error`, `connect`, and `disconnect`, so readiness-before-action and wildcard
  subscriptions are reachable without dropping down to `SSEProvider`. Add the
  `useSSEAnyEvent(connection, handler)` hook for subscribing to every event
  regardless of name — useful when the event discriminator lives in the payload.

### Patch Changes

- Updated dependencies [0cbeac0]
- Updated dependencies [0cbeac0]
  - @flamefrontend/sse-runtime-core@0.5.0

## 0.4.1

### Patch Changes

- 929b2c6: Fix `enabled: false` disabling the imperative API. Previously a client created with `enabled: false` had `connect()` and `ensureOpen()` permanently no-op (status stuck at `idle`), so a manual "Connect" button could never open the stream.

  `enabled` now only controls whether the React hook auto-connects on mount (matching the `enabled` semantics of libraries like React Query). The imperative `connect()`, `disconnect()`, and `ensureOpen()` work regardless of `enabled`; `enabled: false` still seeds the initial status as `idle` and the hook still skips auto-connect.

- Updated dependencies [929b2c6]
  - @flamefrontend/sse-runtime-core@0.4.1

## 0.4.0

### Minor Changes

- 6e222cb: Add production-readiness contracts: connection readiness API, open timeout, custom retry policy, and rich diagnostics.

  **New: `ensureOpen({ timeout? })`** on `SSEClient` — resolves `true` when the stream is open, `false` on terminal failure, and rejects if the optional timeout expires. Starts connecting automatically if the client is idle. Safe to call concurrently; all callers share the same wait.

  **New: `openTimeout`** option — abort the HTTP connection attempt if the server does not respond within the given number of milliseconds. Works with `reconnect` so timed-out attempts are retried normally.

  **New: `retry`** option (`RetryPolicyOptions`) — per-error `shouldRetry` predicate and `getDelay` function. `maxRetries` from `reconnect` is always enforced as a hard cap; `shouldRetry` is an additional per-error filter applied within that cap.

  **New diagnostics callbacks** on `DiagnosticsOptions`:
  - `onOpen({ url })` — fires when the HTTP response is accepted and the stream starts.
  - `onDisconnect({ url, reason })` — fires on any disconnect with reason `"manual"`, `"error"`, or `"stream-ended"`.
  - `onRawEvent(info)` — fires for every parsed SSE event before handlers run; carries the raw data string, id, retry, timestamp, and connection key.
  - `onParseError({ error, eventName })` — fires when a JSON payload for a named subscriber cannot be parsed.

  **React adapter parity** — `heartbeat`, `diagnostics`, `retry`, and `openTimeout` are now correctly forwarded through `createReactClientOptions` with live getter proxies so callback identity changes do not require client recreation.

  **Internal improvements:**
  - `combineSignals` extracted to a shared utility (`utils/combine-signals.ts`), removing a duplicate between the transport and client layers.
  - `ensureOpen` logic extracted to `buildEnsureOpen` helper, shared between the local and coordinated client implementations.
  - Coordinated client `disconnect()` always fires `onDisconnect("manual")` regardless of tab role; the inner leader engine no longer double-fires it.

### Patch Changes

- Updated dependencies [6e222cb]
  - @flamefrontend/sse-runtime-core@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [5fbf120]
  - @flamefrontend/sse-runtime-core@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [491ce34]
  - @flamefrontend/sse-runtime-core@0.3.1

## 0.3.0

### Minor Changes

- Add `@flamefrontend/sse-runtime-devtools` — a developer tools panel for inspecting active SSE connections.

  **New package: `@flamefrontend/sse-runtime-devtools`**

  Wrap your app with `SSEDevtoolsProvider` to get a floating panel that shows all active connections, their status, event log, and connection controls.

  ```tsx
  import { SSEDevtoolsProvider } from "@flamefrontend/sse-runtime-devtools";

  <SSEDevtoolsProvider>
    <App />
  </SSEDevtoolsProvider>;
  ```

  Features:
  - Per-connection status indicator (open / connecting / reconnecting / error / closed) with animated dot
  - Event log with timestamp, event type badge, and expandable data preview (last 100 events per connection)
  - Connect / Disconnect controls from the panel
  - Auto-scroll with smart scroll-lock
  - Clear events log per connection
  - Configurable panel height and toggle button position
  - Zero external UI dependencies — fully inline styles, dark theme

  **`@flamefrontend/sse-runtime-core`**: adds `client.subscribeAnyEvent(handler)` — a wildcard observer invoked for every event (with `{ type, data }`) regardless of whether a named handler is registered. Intended for diagnostics/devtools; handler errors are swallowed and never affect the stream. Also exports the `SSEAnyEventHandler` and `SSEEventEnvelope` types.

  **`@flamefrontend/sse-runtime-react`**: exports `SSEDevtoolsRegistrationContext`, `SSEDevtoolsClientInfo`, and `SSEDevtoolsRegistration` as the integration point for the devtools layer. `useSSE` and `SSEProvider` automatically register with this context when `SSEDevtoolsProvider` is present.

  The devtools panel captures **all** events via `subscribeAnyEvent` (not only those declared in `options.events`), assigns each connection a unique registry id so connections sharing a logical key can't clobber each other, batches re-renders to one per animation frame, and supports filtering the event log by type or data.

### Patch Changes

- Updated dependencies
  - @flamefrontend/sse-runtime-core@0.3.0

## 0.2.0

### Minor Changes

- f38174e: Add heartbeat timeout, runtime event subscriptions, and React provider hooks.

  **core:**
  - `SSEClientOptions.heartbeat.timeout` — aborts and reconnects when no bytes arrive within the configured window
  - `client.subscribeEvent(eventName, handler)` — subscribe to named events at runtime; returns an unsubscribe function
  - `SSEClient` is now generic (`SSEClient<Events>`) with `EventMap` as default for backward compatibility
  - `HeartbeatOptions` exported from public API

  **react:**
  - `SSEProvider<Events>` — owns the client lifecycle and provides it to children via React context
  - `useSSEEvent(connection, eventName, handler)` — subscribe to a named event; handler is kept in a ref to always call the latest closure without resubscribing
  - `useSSEStatus(connection)` — returns `{ status, error }` for components that only need connection state
  - `useSSEContext<Events>()` — retrieves the `SSEClient` from the nearest `SSEProvider`

### Patch Changes

- Updated dependencies
- Updated dependencies [f38174e]
  - @flamefrontend/sse-runtime-core@0.2.0
