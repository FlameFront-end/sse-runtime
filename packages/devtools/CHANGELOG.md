# @flamefrontend/sse-runtime-devtools

## 1.0.0

### Patch Changes

- Updated dependencies [6e222cb]
  - @flamefrontend/sse-runtime-core@0.4.0
  - @flamefrontend/sse-runtime-react@0.4.0

## 0.3.3

### Patch Changes

- Updated dependencies [5fbf120]
  - @flamefrontend/sse-runtime-core@0.3.2
  - @flamefrontend/sse-runtime-react@0.3.2

## 0.3.2

### Patch Changes

- Updated dependencies [491ce34]
  - @flamefrontend/sse-runtime-core@0.3.1
  - @flamefrontend/sse-runtime-react@0.3.1

## 0.3.1

### Patch Changes

- 614d6d5: Redesign the DevTools panel, add automatic light/dark theme handling with manual switching, improve compact mobile layout behavior, and reduce unnecessary DevTools re-renders during stream updates.

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
  - @flamefrontend/sse-runtime-react@0.3.0
  - @flamefrontend/sse-runtime-core@0.3.0
