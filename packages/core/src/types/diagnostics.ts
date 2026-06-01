import type { SSEError } from "./errors";

export type RawEventDiagnosticInfo = {
  readonly event: string;
  readonly data: string;
  readonly id: string | undefined;
  readonly retry: number | undefined;
  readonly timestamp: number;
  readonly connectionKey: readonly string[];
};

export type DisconnectReason = "manual" | "error" | "stream-ended";

export type DisconnectDiagnosticInfo = {
  readonly url: string;
  readonly reason: DisconnectReason;
};

export type DiagnosticsOptions = {
  readonly onAttempt?: (info: { readonly attempt: number; readonly url: string }) => void;
  readonly onReconnectScheduled?: (info: {
    readonly attempt: number;
    readonly delay: number;
    readonly error: SSEError;
  }) => void;
  readonly onAuthRefresh?: (info: { readonly error: SSEError }) => void;
  readonly onCoordinationRoleChange?: (info: { readonly role: "leader" | "follower" }) => void;
  readonly onRawEvent?: (info: RawEventDiagnosticInfo) => void;
  readonly onOpen?: (info: { readonly url: string }) => void;
  readonly onDisconnect?: (info: DisconnectDiagnosticInfo) => void;
  readonly onParseError?: (info: { readonly error: unknown; readonly eventName: string }) => void;
};
