export type ReactNativeAppStateStatus =
  | "active"
  | "background"
  | "inactive"
  | "unknown"
  | "extension";

export type ReactNativeSubscription = {
  readonly remove: () => void;
};

export type ReactNativeAppState = {
  readonly currentState: ReactNativeAppStateStatus | null;
  readonly addEventListener: (
    type: "change",
    listener: (state: ReactNativeAppStateStatus) => void
  ) => ReactNativeSubscription;
};

export type ReactNativeNetInfoState = {
  readonly isConnected: boolean | null;
};

export type ReactNativeNetInfo = {
  readonly addEventListener: (
    listener: (state: ReactNativeNetInfoState) => void
  ) => ReactNativeSubscription | (() => void);
};
