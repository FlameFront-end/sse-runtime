# @flamefrontend/sse-runtime-react

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
