import type { CoordinationMessage } from "./coordination-message";

export type CoordinationChannel = {
  readonly post: (message: CoordinationMessage) => void;
  readonly subscribe: (listener: (message: CoordinationMessage) => void) => () => void;
  readonly close: () => void;
};

export type CoordinationBackend = {
  readonly createChannel: (name: string) => CoordinationChannel;
  // Resolves once this context has acquired leadership for `name`. Leadership is
  // held until `signal` is aborted. Rejects if the request is aborted before it
  // is granted.
  readonly requestLeadership: (name: string, signal: AbortSignal) => Promise<void>;
};

export function createDefaultCoordinationBackend(): CoordinationBackend | null {
  if (
    typeof BroadcastChannel === "undefined" ||
    typeof navigator === "undefined" ||
    typeof navigator.locks === "undefined"
  ) {
    return null;
  }

  return {
    createChannel(name: string): CoordinationChannel {
      const channel = new BroadcastChannel(name);

      return {
        post(message: CoordinationMessage): void {
          channel.postMessage(message);
        },
        subscribe(listener: (message: CoordinationMessage) => void): () => void {
          const handler = (event: MessageEvent): void => {
            listener(event.data as CoordinationMessage);
          };

          channel.addEventListener("message", handler);

          return () => {
            channel.removeEventListener("message", handler);
          };
        },
        close(): void {
          channel.close();
        }
      };
    },

    requestLeadership(name: string, signal: AbortSignal): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        navigator.locks
          .request(name, { signal }, () => {
            // Leadership granted. Hold the lock until the signal is aborted.
            resolve();

            return new Promise<void>((release) => {
              if (signal.aborted) {
                release();

                return;
              }

              signal.addEventListener("abort", () => release(), { once: true });
            });
          })
          .catch((cause: unknown) => {
            // AbortError when the pending request is aborted before being granted.
            reject(cause instanceof Error ? cause : new Error("Leadership request failed"));
          });
      });
    }
  };
}
