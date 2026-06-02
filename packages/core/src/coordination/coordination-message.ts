import type { ParsedSSEEvent } from "../parser/parse-sse-chunk";
import type {
  DisconnectDiagnosticInfo,
  RawEventDiagnosticInfo,
  SSEConnectionStatus,
  SSEError
} from "../types/public";

export type CoordinationDiagnostic =
  | { readonly kind: "rawEvent"; readonly info: RawEventDiagnosticInfo }
  | { readonly kind: "open"; readonly info: { readonly url: string } }
  | { readonly kind: "disconnect"; readonly info: DisconnectDiagnosticInfo };

export type CoordinationMessage =
  | { readonly type: "hello" }
  | { readonly type: "status"; readonly status: SSEConnectionStatus }
  | { readonly type: "error"; readonly error: SSEError | null }
  | { readonly type: "event"; readonly event: ParsedSSEEvent }
  | { readonly type: "diagnostic"; readonly diagnostic: CoordinationDiagnostic };
