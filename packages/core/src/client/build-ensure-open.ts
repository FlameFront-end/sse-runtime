import type { SSEConnectionStatus, SSEStatusListener } from "../types/public";

type EnsureOpenState = {
  readonly getStatus: () => SSEConnectionStatus;
  readonly subscribeStatus: (listener: SSEStatusListener) => () => void;
};

/**
 * Shared implementation for `ensureOpen` used by both the local and coordinated
 * SSE clients. Returns a promise that resolves `true` when the connection is open,
 * `false` on terminal error, and rejects if an optional timeout expires.
 *
 * `doConnect` is called when the client needs to start connecting. It must be
 * idempotent (a no-op if already connecting or already active).
 */
export function buildEnsureOpen(
  getEnabled: () => boolean,
  state: EnsureOpenState,
  doConnect: () => void
): (ensureOptions?: { readonly timeout?: number }) => Promise<boolean> {
  return (ensureOptions) => {
    if (!getEnabled()) {
      return Promise.resolve(false);
    }

    if (state.getStatus() === "open") {
      return Promise.resolve(true);
    }

    let resolveReadiness!: (value: boolean) => void;
    const readinessPromise = new Promise<boolean>((res) => {
      resolveReadiness = res;
    });

    let initialized = false;
    const unsub = state.subscribeStatus((status) => {
      if (!initialized) {
        initialized = true;
        return;
      }
      if (status === "open") {
        unsub();
        resolveReadiness(true);
      } else if (status === "error" || status === "closed") {
        unsub();
        resolveReadiness(false);
      }
    });

    if (state.getStatus() === "closed" || state.getStatus() === "error") {
      doConnect();
    }

    if (ensureOptions?.timeout == null) {
      return readinessPromise;
    }

    return new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`SSE ensureOpen timed out after ${ensureOptions.timeout}ms`));
      }, ensureOptions.timeout);

      readinessPromise.then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  };
}
