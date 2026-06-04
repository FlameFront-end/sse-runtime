import type { EventMap, SSEClient } from "@flamefrontend/sse-runtime-core";

import type { ReactNativeAppState, ReactNativeNetInfo, ReactNativeSubscription } from "./types";

export type ReactNativeLifecycleResumeStrategy = "ensure" | "reconnect";

export type ReactNativeLifecycleResumeOptions = {
  readonly appState: ReactNativeAppState;
  readonly netInfo?: ReactNativeNetInfo;
  readonly strategy?: ReactNativeLifecycleResumeStrategy;
  readonly throttleMs?: number;
  readonly staleTimeoutMs?: number;
  readonly wakeDriftMs?: number;
  readonly minBackgroundMs?: number;
  readonly getLastActivityAt?: () => number | undefined;
};

const DEFAULT_THROTTLE_MS = 2000;
const WATCHDOG_INTERVAL_MS = 30_000;

export function attachReactNativeLifecycleResume<Events extends EventMap>(
  client: Pick<SSEClient<Events>, "ensureOpen" | "getLastEventAt" | "getStatus" | "reconnect">,
  options: ReactNativeLifecycleResumeOptions
): () => void {
  const strategy = options.strategy ?? "ensure";
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
  const getLastActivityAt = options.getLastActivityAt ?? client.getLastEventAt;

  let lastRunAt = 0;
  let backgroundAt: number | null = isActive(options.appState.currentState) ? null : Date.now();

  const cleanups: Array<() => void> = [
    subscribeAppState(options.appState, (nextState) => {
      if (!isActive(nextState)) {
        backgroundAt = Date.now();
        return;
      }

      const backgroundFor = backgroundAt === null ? null : Date.now() - backgroundAt;
      backgroundAt = null;

      if (
        options.minBackgroundMs !== undefined &&
        backgroundFor !== null &&
        backgroundFor < options.minBackgroundMs
      ) {
        return;
      }

      resume(true);
    })
  ];

  if (options.netInfo) {
    cleanups.push(
      subscribeNetInfo(options.netInfo, (isConnected) => {
        if (isConnected === true) {
          resume(true);
        }
      })
    );
  }

  if (options.staleTimeoutMs !== undefined || options.wakeDriftMs !== undefined) {
    const checkInterval = Math.min(
      WATCHDOG_INTERVAL_MS,
      options.staleTimeoutMs ?? Number.POSITIVE_INFINITY,
      options.wakeDriftMs ?? Number.POSITIVE_INFINITY
    );
    let lastTickAt = Date.now();
    const intervalId = setInterval(() => {
      const now = Date.now();
      const drift = now - lastTickAt - checkInterval;
      lastTickAt = now;

      if (options.wakeDriftMs !== undefined && drift > options.wakeDriftMs) {
        resume(true);
        return;
      }

      if (isStale()) {
        resume(true);
      }
    }, checkInterval);
    cleanups.push(() => clearInterval(intervalId));
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };

  function resume(force: boolean): void {
    if (!force && !isStale()) {
      return;
    }

    const now = Date.now();
    if (now - lastRunAt < throttleMs) {
      return;
    }
    lastRunAt = now;

    if (strategy === "reconnect") {
      void client.reconnect();
      return;
    }

    void client.ensureOpen();
  }

  function isStale(): boolean {
    if (options.staleTimeoutMs === undefined) {
      return false;
    }
    if (client.getStatus() !== "open") {
      return true;
    }
    const lastActivityAt = getLastActivityAt();
    if (lastActivityAt === undefined || lastActivityAt <= 0) {
      return false;
    }
    return Date.now() - lastActivityAt > options.staleTimeoutMs;
  }
}

function subscribeAppState(
  appState: ReactNativeAppState,
  listener: (state: ReactNativeAppState["currentState"]) => void
): () => void {
  return removeSubscription(appState.addEventListener("change", listener));
}

function subscribeNetInfo(
  netInfo: ReactNativeNetInfo,
  listener: (isConnected: boolean | null) => void
): () => void {
  return removeSubscription(netInfo.addEventListener((state) => listener(state.isConnected)));
}

function removeSubscription(subscription: ReactNativeSubscription | (() => void)): () => void {
  if (typeof subscription === "function") {
    return subscription;
  }

  return () => subscription.remove();
}

function isActive(state: ReactNativeAppState["currentState"]): boolean {
  return state === "active";
}
