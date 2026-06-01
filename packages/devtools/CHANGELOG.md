# @flamefrontend/sse-runtime-devtools

## 1.1.0

### Minor Changes

- 562b18a: Improve the DevTools panel: more information, better usability, and several bug fixes.

  **Bug fixes:**
  - Keyboard shortcut now matches the physical key (`KeyboardEvent.code`), so the default `Alt+D` works on macOS where Option rewrites the character. The shortcut is also ignored while typing in inputs/textareas/`contenteditable`.
  - Mobile resize now works — the resize grip is a larger touch target and binds move/up to the captured pointer instead of `window`.
  - Scrolling inside the panel no longer scrolls the page underneath (`overscroll-behavior: contain` on all scrollable areas).
  - A connection that was already `open` before DevTools mounted now shows its connected time/uptime instead of nothing.
  - `connectedAt` is preserved across reconnects via a separate `firstConnectedAt`; reconnects are counted instead of resetting the timer.
  - `null` and `undefined` payloads are distinguished (`null` vs `(no data)`) and no longer show a pointless "View" expander.

  **New features:**
  - The toggle button is draggable, and its position is remembered.
  - The toggle button reflects the worst connection status (error/reconnecting pulse) at a glance.
  - Pause the event log to inspect it while the stream keeps running.
  - Copy a single event payload, or export the whole log as JSON.
  - Click an event-type badge to filter the log to that type.
  - New per-connection metrics: events/sec, uptime, reconnect count, and time since the last event.
  - Three-state theme (Auto/Light/Dark) instead of a binary toggle; the choice is remembered.
  - New `zIndex` prop to control stacking order.
  - Open state, panel height, theme, and toggle-button position persist across reloads.

  **Accessibility:**
  - Connection rows are real buttons (keyboard-navigable); events are expandable via Enter/Space.
  - `Esc` closes the panel; the panel exposes `role="dialog"` and the close button has an `aria-label`.

  **Performance:**
  - The registry snapshot is cloned lazily inside a single animation frame instead of on every event, so high-frequency streams no longer clone the client map per event.

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
