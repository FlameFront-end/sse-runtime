# @flamefrontend/sse-runtime-devtools

Developer tools panel for inspecting active SSE connections managed by [`@flamefrontend/sse-runtime-react`](../react).

Wrap your app once with `SSEDevtoolsProvider`. Every `useSSE` call and `SSEProvider` instance inside the tree registers automatically — no manual wiring needed.

## Install

```bash
npm install @flamefrontend/sse-runtime-devtools
# or
pnpm add @flamefrontend/sse-runtime-devtools
```

> **Peer dependencies:** `@flamefrontend/sse-runtime-core`, `@flamefrontend/sse-runtime-react`, `react ≥ 18`

## Usage

```tsx
import { SSEDevtoolsProvider } from "@flamefrontend/sse-runtime-devtools";

createRoot(document.getElementById("root")).render(
  <SSEDevtoolsProvider>
    <App />
  </SSEDevtoolsProvider>
);
```

A `⚡ SSE` toggle button appears in the bottom-right corner. Click it to open the panel, or **drag it** anywhere — its position is remembered. The default keyboard shortcut `Alt+D` also toggles it (matched by physical key, so it works on macOS where Option rewrites the character). Press `Esc` to close the panel (ignored while you are typing in the filter field).

## Production builds

Pass `enabled={false}` (or a condition) to disable the devtools entirely. When disabled the provider renders only its children — no registry, no UI, no overhead.

```tsx
<SSEDevtoolsProvider enabled={import.meta.env.DEV}>
  <App />
</SSEDevtoolsProvider>
```

## Props

| Prop               | Type                              | Default          | Description                                               |
| ------------------ | --------------------------------- | ---------------- | --------------------------------------------------------- |
| `enabled`          | `boolean`                         | `true`           | Disable completely — renders only `children` when `false` |
| `initialOpen`      | `boolean`                         | `false`          | Open the panel on mount                                   |
| `buttonPosition`   | `"bottom-left" \| "bottom-right"` | `"bottom-right"` | Position of the toggle button                             |
| `panelHeight`      | `number`                          | `320`            | Initial panel height in pixels (draggable at runtime)     |
| `hideToggleButton` | `boolean`                         | `false`          | Hide the floating `⚡ SSE` button                         |
| `toggleShortcut`   | `string`                          | `"alt+d"`        | Keyboard shortcut to open/close — e.g. `"ctrl+shift+d"`   |
| `maxEvents`        | `number`                          | `100`            | Maximum events kept per connection in the log             |
| `zIndex`           | `number`                          | `99999`          | Stacking order of the panel and toggle button             |

### Shortcut format

`toggleShortcut` is a `+`-separated string of modifier keys and a regular key: `"alt+d"`, `"ctrl+shift+d"`, `"meta+k"`. Modifiers: `alt`, `ctrl`, `shift`, `meta`.

Set `toggleShortcut=""` to disable the shortcut entirely.

## Panel features

- **Connection list** — all active SSE connections with a live status indicator (animated dot while connecting/reconnecting); same-path connections stay distinguishable by query string
- **Detail pane** — URL, status, connected-at timestamp, connection key, error box
- **Metrics** — events received, events/sec (measured over a 5s window independent of the log cap), uptime, reconnect count, time since last event, events in log
- **Event log** — last `maxEvents` events per connection with timestamp, event-type badge, and expandable payload
- **Filter** — by type or data content; click a type badge to filter to that type
- **Pause** — freeze the log to inspect while the stream keeps running (shows how many arrived while paused)
- **Copy / Export** — copy a single payload, or export the log as JSON (captured payloads are snapshotted on arrival, so later mutations in your app don't alter the log; the export marks `truncated: true` and reports `eventsInLog` when older events were dropped by the cap)
- **All events captured** — uses `subscribeAnyEvent` internally, so events with no declared handler are visible too
- **Actions** — Connect / Disconnect buttons per connection (an imperative override of the live connection; React state owned by `useSSE` is unaffected and may reconnect on the next render); Clear log button
- **Auto-scroll** — follows new events; pauses when you scroll up; respects the active filter
- **Resizable** — drag the grip at the top of the panel (works with touch), or focus it and use ↑/↓ (hold Shift for larger steps); the height is remembered
- **Theme** — Auto / Light / Dark, remembered across reloads
- **Toggle button** — shows the worst connection status at a glance and is draggable
- **Accessible** — keyboard-navigable connection list, keyboard-resizable panel, focus moves into the panel on open and returns to the previously focused element on close, `Esc` to close, ARIA labels
- **Remembers** — open state, panel height, theme, and toggle-button position persist via `localStorage`

## More Documentation

Full guide: https://github.com/FlameFront-end/sse-runtime#readme

## License

MIT
