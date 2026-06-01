import type { ParsedSSEEvent } from "../parser/parse-sse-chunk";
import type { SSEConnectionStatus, SSEError } from "../types/public";

export type CoordinationMessage =
  | { readonly type: "hello" }
  | { readonly type: "status"; readonly status: SSEConnectionStatus }
  | { readonly type: "error"; readonly error: SSEError | null }
  | { readonly type: "event"; readonly event: ParsedSSEEvent };
