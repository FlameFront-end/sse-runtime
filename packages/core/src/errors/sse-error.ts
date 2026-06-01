import type { SSEError, SSEErrorKind } from "../types/public";

export function createHTTPError(response: Response): SSEError {
  return {
    kind: "transport",
    message: `SSE request failed with status ${response.status}`,
    status: response.status
  };
}

export function createTransportError(message: string): SSEError {
  return {
    kind: "transport",
    message
  };
}

export function normalizeError(cause: unknown, kind: SSEErrorKind): SSEError {
  if (isSSEError(cause)) {
    return cause;
  }

  if (cause instanceof Error) {
    return {
      kind,
      message: cause.message,
      cause
    };
  }

  return {
    kind,
    message: "SSE connection failed",
    cause
  };
}

function isSSEError(value: unknown): value is SSEError {
  return (
    value instanceof Error === false &&
    typeof value === "object" &&
    value !== null &&
    hasSSEErrorKind(value) &&
    "message" in value
  );
}

function hasSSEErrorKind(value: object): value is { readonly kind: SSEErrorKind } {
  return (
    "kind" in value &&
    (value.kind === "auth" || value.kind === "handler" || value.kind === "transport")
  );
}
