import type { SSEClient } from "../client/create-local-sse-client";
import type { EventMap } from "../types/public";

export type ReconnectNotificationHandlers = {
  readonly onReconnecting?: () => void;
  readonly onReconnected?: () => void;
  readonly onFailed?: () => void;
};

export function attachReconnectNotifications<Events extends EventMap>(
  client: SSEClient<Events>,
  handlers: ReconnectNotificationHandlers
): () => void {
  let reconnecting = false;

  return client.subscribeStatus((status) => {
    if (status === "reconnecting") {
      if (!reconnecting) {
        reconnecting = true;
        handlers.onReconnecting?.();
      }
      return;
    }

    if (status === "open") {
      if (reconnecting) {
        reconnecting = false;
        handlers.onReconnected?.();
      }
      return;
    }

    if (status === "error") {
      if (reconnecting) {
        reconnecting = false;
        handlers.onFailed?.();
      }
      return;
    }

    if (status === "closed" || status === "idle") {
      reconnecting = false;
    }
  });
}
