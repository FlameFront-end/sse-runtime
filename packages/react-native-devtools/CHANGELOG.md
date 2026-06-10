# @flamefrontend/sse-runtime-react-native-devtools

## 2.0.0

### Patch Changes

- Updated dependencies [13b8229]
  - @flamefrontend/sse-runtime-core@0.10.0
  - @flamefrontend/sse-runtime-react-native@0.3.2

## 1.0.6

### Patch Changes

- d1a22da: Fix the React Native DevTools panel using native animated driver on unsupported height styles.

## 1.0.5

### Patch Changes

- Make React Native DevTools panel resizing and swipe-down closing smoother by driving drag height with Animated values instead of React render state.

## 1.0.4

### Patch Changes

- c6fda76: Remove the duplicated mobile detail status row, move the connection status dot into the header URL row, collapse metrics into a compact mobile summary by default, align event rows with the web DevTools collapsed/expanded log behavior, animate the React Native DevTools panel open and closed, and make resize and swipe-down close gestures stable.

## 1.0.3

### Patch Changes

- c6fda76: Remove the duplicated mobile detail status row, collapse metrics into a compact mobile summary by default, animate the React Native DevTools panel open and closed, and make the resize handle easier to drag with swipe-down close support.

## 1.0.2

### Patch Changes

- ba88d19: Rework the React Native DevTools panel as a mobile-first bottom sheet with connection-to-log navigation, draggable height resizing, theme switching, event export hooks, and copy/expand controls for event payloads. Add React Native/default export conditions for Metro compatibility.
- Updated dependencies [ba88d19]
  - @flamefrontend/sse-runtime-react-native@0.3.1
  - @flamefrontend/sse-runtime-core@0.9.1

## 1.0.1

### Patch Changes

- ae8413e: Split React Native DevTools panel UI into focused component files with colocated styles.

## 1.0.0

### Minor Changes

- 1667cae: Add React Native SSE DevTools with a native overlay panel and register React Native SSE clients with devtools providers.

### Patch Changes

- Updated dependencies [d259be9]
- Updated dependencies [35e9918]
- Updated dependencies [65daaa7]
- Updated dependencies [1667cae]
- Updated dependencies [bbb53c0]
  - @flamefrontend/sse-runtime-core@0.9.0
  - @flamefrontend/sse-runtime-react-native@0.2.0
