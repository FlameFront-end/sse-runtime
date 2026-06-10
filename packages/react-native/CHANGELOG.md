# @flamefrontend/sse-runtime-react-native

## 0.3.2

### Patch Changes

- Updated dependencies [13b8229]
  - @flamefrontend/sse-runtime-core@0.10.0

## 0.3.1

### Patch Changes

- ba88d19: Rework the React Native DevTools panel as a mobile-first bottom sheet with connection-to-log navigation, draggable height resizing, theme switching, event export hooks, and copy/expand controls for event payloads. Add React Native/default export conditions for Metro compatibility.
- Updated dependencies [ba88d19]
  - @flamefrontend/sse-runtime-core@0.9.1

## 0.3.0

### Minor Changes

- bbb53c0: Add a React Native XMLHttpRequest transport for streaming SSE responses in runtimes where fetch does not expose a compatible response body stream.

### Patch Changes

- 1667cae: Register React Native SSE clients with React Native DevTools providers.
- Updated dependencies [d259be9]
- Updated dependencies [35e9918]
  - @flamefrontend/sse-runtime-core@0.9.0

## 0.2.0

### Minor Changes

- 65daaa7: Add the React Native package with hook/provider APIs, dependency injection for runtime transports, and AppState/NetInfo-compatible lifecycle resume helpers.
