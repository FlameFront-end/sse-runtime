export type ReconnectRequestOptions = {
  readonly reason?: string;
  readonly timeout?: number;
};

export type EnsureHealthyOptions = ReconnectRequestOptions & {
  readonly staleAfter: number;
  readonly timeout?: number;
};

export type SSEActivityListener = (timestamp: number) => void;

export type SSERecoveryPhase = "requested" | "started" | "succeeded" | "failed";

export type SSERecoveryEvent = {
  readonly phase: SSERecoveryPhase;
  readonly reason: string;
  readonly timestamp: number;
};

export type SSERecoveryListener = (event: SSERecoveryEvent) => void;
