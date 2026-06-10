import type { ParsedSSEEvent } from "../parser/parse-sse-chunk";
import type {
  DisconnectDiagnosticInfo,
  RawEventDiagnosticInfo,
  SSEConnectionStatus,
  SSEError,
  SSERecoveryEvent
} from "../types/public";

export type CoordinationDiagnostic =
  | { readonly kind: "rawEvent"; readonly info: RawEventDiagnosticInfo }
  | { readonly kind: "open"; readonly info: { readonly url: string } }
  | { readonly kind: "disconnect"; readonly info: DisconnectDiagnosticInfo };

export type CoordinationMessage =
  | { readonly type: "hello" }
  | { readonly type: "status"; readonly status: SSEConnectionStatus }
  | { readonly type: "error"; readonly error: SSEError | null }
  | { readonly type: "activity"; readonly timestamp: number }
  | { readonly type: "recovery"; readonly event: SSERecoveryEvent }
  | { readonly type: "reconnect-request"; readonly requestId: string; readonly reason: string }
  | { readonly type: "reconnect-result"; readonly requestId: string; readonly ok: boolean }
  | { readonly type: "event"; readonly event: ParsedSSEEvent }
  | { readonly type: "diagnostic"; readonly diagnostic: CoordinationDiagnostic };
