import type { SSEError } from "./errors";

export type DiagnosticsOptions = {
  readonly onAttempt?: (info: { readonly attempt: number; readonly url: string }) => void;
  readonly onReconnectScheduled?: (info: {
    readonly attempt: number;
    readonly delay: number;
    readonly error: SSEError;
  }) => void;
  readonly onAuthRefresh?: (info: { readonly error: SSEError }) => void;
  readonly onCoordinationRoleChange?: (info: { readonly role: "leader" | "follower" }) => void;
};
