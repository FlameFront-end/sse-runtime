import { describe, expect, it, vi } from "vitest";

import { attachReactNativeLifecycleResume } from "./attach-react-native-lifecycle-resume";
import type { ReactNativeAppStateStatus } from "./types";

describe("attachReactNativeLifecycleResume", () => {
  it("ensures the connection when the app returns to active state", () => {
    const appState = createAppState("background");
    const ensureOpen = vi.fn(async () => true);

    const detach = attachReactNativeLifecycleResume(createClient({ ensureOpen }), {
      appState,
      throttleMs: 0
    });

    appState.emitChange("active");

    expect(ensureOpen).toHaveBeenCalledTimes(1);

    detach();
    appState.emitChange("background");
    appState.emitChange("active");

    expect(ensureOpen).toHaveBeenCalledTimes(1);
  });

  it("reconnects when network connectivity is restored", () => {
    const appState = createAppState("active");
    const netInfo = createNetInfo();
    const reconnect = vi.fn(async () => undefined);

    attachReactNativeLifecycleResume(createClient({ reconnect }), {
      appState,
      netInfo,
      strategy: "reconnect",
      throttleMs: 0
    });

    netInfo.emit({ isConnected: false });
    netInfo.emit({ isConnected: true });

    expect(reconnect).toHaveBeenCalledTimes(1);
  });
});

function createClient(overrides: {
  readonly ensureOpen?: () => Promise<boolean>;
  readonly reconnect?: () => Promise<void>;
}) {
  return {
    ensureOpen: overrides.ensureOpen ?? vi.fn(async () => true),
    reconnect: overrides.reconnect ?? vi.fn(async () => undefined),
    getStatus: () => "open" as const,
    getLastEventAt: () => undefined
  };
}

function createAppState(initialState: ReactNativeAppStateStatus | null) {
  const listeners = new Set<(state: ReactNativeAppStateStatus) => void>();

  return {
    currentState: initialState,
    addEventListener: vi.fn(
      (type: "change", listener: (state: ReactNativeAppStateStatus) => void) => {
        expect(type).toBe("change");
        listeners.add(listener);

        return {
          remove: () => listeners.delete(listener)
        };
      }
    ),
    emitChange(nextState: ReactNativeAppStateStatus) {
      this.currentState = nextState;
      for (const listener of listeners) {
        listener(nextState);
      }
    }
  };
}

function createNetInfo() {
  const listeners = new Set<(state: { readonly isConnected: boolean | null }) => void>();

  return {
    addEventListener: vi.fn(
      (listener: (state: { readonly isConnected: boolean | null }) => void) => {
        listeners.add(listener);

        return () => listeners.delete(listener);
      }
    ),
    emit(state: { readonly isConnected: boolean | null }) {
      for (const listener of listeners) {
        listener(state);
      }
    }
  };
}
