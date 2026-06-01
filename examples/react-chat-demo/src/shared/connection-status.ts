import type { ConnectionStatus } from "../features/chat-stream/model/chat-stream-types";

export function formatConnectionStatus(status: ConnectionStatus): string {
  if (status === "idle") {
    return "Idle";
  }

  if (status === "open") {
    return "Live";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function describeConnectionStatus(status: ConnectionStatus): string {
  if (status === "idle" || status === "closed") {
    return "The stream is not connected.";
  }

  if (status === "connecting") {
    return "Opening the SSE request.";
  }

  if (status === "open") {
    return "Events are arriving from the mock server.";
  }

  if (status === "reconnecting") {
    return "Connection lost; retrying with backoff.";
  }

  return "The stream stopped with an error.";
}
