export type SSEConnectionStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "error"
  | "closed";

export type SSEStatusListener = (status: SSEConnectionStatus) => void;
