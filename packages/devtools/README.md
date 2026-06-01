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

A `⚡ SSE` toggle button appears in the bottom-right corner. Click it to open the panel. The default keyboard shortcut `Alt+D` also toggles it.

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

### Shortcut format

`toggleShortcut` is a `+`-separated string of modifier keys and a regular key: `"alt+d"`, `"ctrl+shift+d"`, `"meta+k"`. Modifiers: `alt`, `ctrl`, `shift`, `meta`.

Set `toggleShortcut=""` to disable the shortcut entirely.

## Panel features

- **Connection list** — all active SSE connections with a live status indicator (animated dot while connecting/reconnecting)
- **Detail pane** — URL, status, connected-at timestamp, connection key, error box
- **Event log** — last `maxEvents` events per connection with timestamp, event-type badge, and expandable payload; filter by type or data content
- **All events captured** — uses `subscribeAnyEvent` internally, so events with no declared handler are visible too
- **Actions** — Connect / Disconnect buttons per connection; Clear log button
- **Auto-scroll** — follows new events; pauses when you scroll up
- **Resizable** — drag the top edge of the panel to resize

## More Documentation

Full guide: https://github.com/FlameFront-end/sse-runtime#readme

## License

MIT
