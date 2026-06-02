import type { SSEClient } from "../client/create-local-sse-client";
import type { EventMap } from "../types/public";

export type LifecycleResumeTrigger = "focus" | "online" | "visible" | "pageshow";

export type LifecycleResumeStrategy = "ensure" | "reconnect";

export type LifecycleResumeOptions = {
  readonly triggers?: readonly LifecycleResumeTrigger[];
  readonly strategy?: LifecycleResumeStrategy;
  readonly throttleMs?: number;
};

const DEFAULT_TRIGGERS: readonly LifecycleResumeTrigger[] = [
  "focus",
  "online",
  "visible",
  "pageshow"
];
const DEFAULT_THROTTLE_MS = 2000;

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

  let lastRunAt = 0;

  const resume = (): void => {
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
    window.addEventListener("focus", resume);
    cleanups.push(() => window.removeEventListener("focus", resume));
  }

  if (triggers.includes("online")) {
    window.addEventListener("online", resume);
    cleanups.push(() => window.removeEventListener("online", resume));
  }

  if (triggers.includes("pageshow")) {
    window.addEventListener("pageshow", resume);
    cleanups.push(() => window.removeEventListener("pageshow", resume));
  }

  if (triggers.includes("visible")) {
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        resume();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    cleanups.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
