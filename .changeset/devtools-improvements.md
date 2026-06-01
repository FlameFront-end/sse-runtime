---
"@flamefrontend/sse-runtime-devtools": minor
---

Improve the DevTools panel: more information, better usability, and several bug fixes.

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
