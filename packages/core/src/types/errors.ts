export type SSEErrorKind = "auth" | "handler" | "transport";

export type SSEError = {
  readonly kind: SSEErrorKind;
  readonly message: string;
  readonly status?: number;
  readonly cause?: unknown;
};

export type SSEErrorListener = (error: SSEError | null) => void;
