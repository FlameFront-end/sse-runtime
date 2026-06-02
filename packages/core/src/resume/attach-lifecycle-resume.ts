import type { SSEClient } from "../client/create-local-sse-client";
import type { EventMap } from "../types/public";

export type LifecycleResumeTrigger = "focus" | "online" | "visible" | "pageshow";

export type LifecycleResumeStrategy = "ensure" | "reconnect";

export type LifecycleResumeOptions = {
  readonly triggers?: readonly LifecycleResumeTrigger[];
  readonly strategy?: LifecycleResumeStrategy;
  readonly throttleMs?: number;
  readonly staleTimeoutMs?: number;
  readonly wakeDriftMs?: number;
  readonly minHiddenMs?: number;
  readonly getLastActivityAt?: () => number | undefined;
};

const DEFAULT_TRIGGERS: readonly LifecycleResumeTrigger[] = [
  "focus",
  "online",
  "visible",
  "pageshow"
];
const DEFAULT_THROTTLE_MS = 2000;
const WATCHDOG_INTERVAL_MS = 30_000;

export function attachLifecycleResume<Events extends EventMap>(
  client: SSEClient<Events>,
  options: LifecycleResumeOptions = {}
): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => undefined;
  }

  const triggers = options.triggers ?? DEFAULT_TRIGGERS;
  const strategy = options.strategy ?? "ensure";
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
  const { staleTimeoutMs, wakeDriftMs, minHiddenMs } = options;
  const getLastActivityAt = options.getLastActivityAt ?? client.getLastEventAt;

  let lastRunAt = 0;
  let hiddenAt: number | null = null;

  const isStale = (): boolean => {
    if (staleTimeoutMs === undefined) {
      return false;
    }
    if (client.getStatus() !== "open") {
      return true;
    }
    const lastActivity = getLastActivityAt();
    if (lastActivity === undefined || lastActivity <= 0) {
      return false;
    }
    return Date.now() - lastActivity > staleTimeoutMs;
  };

  const resume = (force: boolean): void => {
    if (!force && staleTimeoutMs !== undefined && client.getStatus() === "open" && !isStale()) {
      return;
    }

    const now = Date.now();
    if (now - lastRunAt < throttleMs) {
      return;
    }
    lastRunAt = now;

    if (strategy === "reconnect") {
      void client.reconnect();
    } else {
      void client.ensureOpen();
    }
  };

  const cleanups: Array<() => void> = [];

  if (triggers.includes("focus")) {
    const onFocus = (): void => resume(false);
    window.addEventListener("focus", onFocus);
    cleanups.push(() => window.removeEventListener("focus", onFocus));
  }

  if (triggers.includes("online")) {
    const onOnline = (): void => resume(true);
    window.addEventListener("online", onOnline);
    cleanups.push(() => window.removeEventListener("online", onOnline));
  }

  if (triggers.includes("pageshow")) {
    const onPageShow = (): void => resume(false);
    window.addEventListener("pageshow", onPageShow);
    cleanups.push(() => window.removeEventListener("pageshow", onPageShow));
  }

  if (triggers.includes("visible")) {
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      const hiddenFor = hiddenAt === null ? null : Date.now() - hiddenAt;
      hiddenAt = null;

      if (minHiddenMs !== undefined && hiddenFor !== null && hiddenFor < minHiddenMs) {
        return;
      }

      resume(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    cleanups.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));
  }

  if (staleTimeoutMs !== undefined || wakeDriftMs !== undefined) {
    const checkInterval = Math.min(
      WATCHDOG_INTERVAL_MS,
      staleTimeoutMs ?? Number.POSITIVE_INFINITY,
      wakeDriftMs ?? Number.POSITIVE_INFINITY
    );
    let lastTickAt = Date.now();
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const drift = now - lastTickAt - checkInterval;
      lastTickAt = now;

      if (wakeDriftMs !== undefined && drift > wakeDriftMs) {
        resume(true);
        return;
      }

      if (isStale()) {
        resume(true);
      }
    }, checkInterval);
    cleanups.push(() => window.clearInterval(intervalId));
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
