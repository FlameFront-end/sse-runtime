# @flamefrontend/sse-runtime-react-native-devtools

React Native overlay for inspecting `@flamefrontend/sse-runtime-react-native`
connections during development.

It mirrors the web devtools data model: active connections, status, role,
errors, reconnect count, event rate, and raw event log.

## Install

```bash
npm install @flamefrontend/sse-runtime-react-native-devtools
```

The package expects your app to use `@flamefrontend/sse-runtime-react-native`.

## Usage

Wrap your app above any `ReactNativeSSEProvider` or `useReactNativeSSE` calls:

```tsx
import { ReactNativeSSEDevtoolsProvider } from "@flamefrontend/sse-runtime-react-native-devtools";

export function App() {
  return (
    <ReactNativeSSEDevtoolsProvider initialOpen={false}>
      <AppProviders />
    </ReactNativeSSEDevtoolsProvider>
  );
}
```

The provider renders a floating `SSE` toggle button. Open it to inspect
connections, event payloads, errors, and reconnects.

## Props

- `enabled` disables all devtools registration and UI when false.
- `initialOpen` opens the panel on first render.
- `hideToggleButton` hides the floating toggle button.
- `maxEvents` limits stored events per connection. Default: `500`.
- `panelHeight` controls overlay height. Default: `420`.
- `theme` accepts `dark` or `light`. Default: `dark`.
- `toggleButtonPosition` accepts `bottom-left`, `bottom-right`, `top-left`, or
  `top-right`. Default: `bottom-right`.

## License

MIT
