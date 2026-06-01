# @flamefrontend/sse-runtime-core

## 0.3.2

### Patch Changes

- 5fbf120: Fix a set of correctness bugs across the core runtime:
  - **Coordination: seamless failover.** Promoting a follower to leader no longer flashes every tab to a disconnected status, and a follower's error state is now cleared when the leader recovers instead of sticking forever.
  - **Coordination: resumption on handoff.** A follower promoted to leader resumes the stream from the last seen `Last-Event-ID` instead of restarting it.
  - **Coordination: lifecycle safety.** Queued follower tasks scheduled before `disconnect()` can no longer dispatch events or resurrect state after teardown.
  - **Heartbeat.** Slow event handlers no longer count against the heartbeat budget, preventing spurious heartbeat timeouts.
  - **Compatibility.** Added a fallback for runtimes without `AbortSignal.any` (Safari < 17.4, Node < 20.3).
  - **Status.** The client now reports `reconnecting` while an auth refresh is in flight, and `connect()` respects `enabled: false`.
  - **Parser.** `id` fields containing a NULL character and `retry` fields with non-ASCII digits are ignored per the SSE spec.

## 0.3.1

### Patch Changes

- 491ce34: Malformed JSON payloads no longer reach typed event handlers. When a server sends data that starts with `{` or `[` but is not valid JSON, the library now sets a transport error and skips the handler instead of silently passing a raw string. Plain-text SSE payloads are unaffected and still passed through as-is. The fix applies to `dispatchSSEEvent` (the `events` option handlers) and `callSubscribers` (handlers registered via `subscribeEvent`), including the coordinated client used in single-tab mode.

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

## 0.2.0

### Minor Changes

- Add structured diagnostics callbacks for observability.

  `SSEClientOptions.diagnostics` accepts four non-critical callbacks that fire at key lifecycle moments without affecting stream behaviour:
  - `onAttempt({ attempt, url })` — fires at the start of every connection attempt
  - `onReconnectScheduled({ attempt, delay, error })` — fires when a reconnect is queued after a failure
  - `onAuthRefresh({ error })` — fires when a 401 triggers an auth-refresh cycle
  - `onCoordinationRoleChange({ role })` — fires when a tab's coordination role changes to `"leader"` or `"follower"`

  Errors thrown inside any diagnostic callback are silently swallowed and do not affect the stream.

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
