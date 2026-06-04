# @flamefrontend/sse-runtime-core

## 0.9.0

### Minor Changes

- d259be9: Add two helpers that remove common boilerplate.
  - `createBearerAuth(getToken, options?)` returns ready-to-spread `headers` and `auth` options for token authentication. The token provider is resolved before every connection attempt and again on `401` (so a refreshing provider recovers transparently), `Authorization` is omitted when no token is available, and the scheme and extra headers are configurable.
  - `attachReconnectNotifications(client, { onReconnecting, onReconnected, onFailed })` turns raw status transitions into reconnect-lifecycle callbacks — fired only for real drops and recoveries, not the initial connect or a manual `disconnect()`. Returns a cleanup function.
    </content>

- 35e9918: Expose the coordination role on coordinated clients. A client created with `coordination: { enabled: true }` now offers `getRole()` and `subscribeRole(listener)`, reporting `"leader"` (this tab owns the real connection) or `"follower"` (this tab mirrors the leader over a `BroadcastChannel`), or `null` once disconnected. Non-coordinated clients omit both methods. This makes the leader/follower split observable without wiring up the `onCoordinationRoleChange` diagnostic.
  </content>

## 0.6.0

### Minor Changes

- 4f29b9f: Add a stale-stream watchdog and richer wildcard events.
  - `attachLifecycleResume` gains `staleTimeoutMs`, `wakeDriftMs`, `minHiddenMs`, and `getLastActivityAt` options. When `staleTimeoutMs` or `wakeDriftMs` is set, a background watchdog recovers a connection the browser never reported as broken — a stream that went silent or whose socket died while the device slept. Wake signals (`online`, `visible`) force a resume; `focus`/`pageshow` resume only when the connection looks unhealthy.
  - `SSEClient.getLastEventAt()` returns the timestamp of the most recently received event, for use as a staleness signal (and as the watchdog's default activity source).
  - `SSEEventEnvelope` delivered to `subscribeAnyEvent` / `useSSEAnyEvent` now includes `raw`, the original unparsed `data` string, alongside the parsed `data`.
    </content>

## 0.5.0

### Minor Changes

- 0cbeac0: Add `client.reconnect()` to force a fresh connection even when the client looks
  `open`, resuming from the last seen event id without emitting a manual-disconnect
  diagnostic. Add `attachLifecycleResume(client, options)`, a browser helper that
  reconnects on `focus`, `online`, `pageshow`, and visibility changes (with
  throttling and an `ensure` vs `reconnect` strategy).
- 0cbeac0: Forward `onRawEvent`, `onOpen`, and `onDisconnect` diagnostics from the
  coordination leader to follower tabs, so every tab can drive logging and
  lifecycle UI — not just the one holding the real connection. `RawEventDiagnosticInfo`
  now carries an optional `role` (`"leader"` | `"follower"`) when coordination is
  enabled. Also fixes `onParseError` not firing in coordinated clients.

## 0.4.1

### Patch Changes

- 929b2c6: Fix `enabled: false` disabling the imperative API. Previously a client created with `enabled: false` had `connect()` and `ensureOpen()` permanently no-op (status stuck at `idle`), so a manual "Connect" button could never open the stream.

  `enabled` now only controls whether the React hook auto-connects on mount (matching the `enabled` semantics of libraries like React Query). The imperative `connect()`, `disconnect()`, and `ensureOpen()` work regardless of `enabled`; `enabled: false` still seeds the initial status as `idle` and the hook still skips auto-connect.

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
