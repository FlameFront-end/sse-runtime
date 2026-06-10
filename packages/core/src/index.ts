export type {
  AuthOptions,
  CoordinationMode,
  CoordinationOptions,
  CoordinationRole,
  DiagnosticsOptions,
  DisconnectDiagnosticInfo,
  DisconnectReason,
  RawEventDiagnosticInfo,
  EventHandler,
  EventMap,
  SSEAnyEventHandler,
  SSEEventEnvelope,
  HeartbeatOptions,
  EnsureHealthyOptions,
  ReconnectRequestOptions,
  ReconnectOptions,
  RetryContext,
  RetryPolicyOptions,
  SSEActivityListener,
  SSEClientOptions,
  SSEConnectionStatus,
  SSEError,
  SSEErrorListener,
  SSERecoveryEvent,
  SSERecoveryListener,
  SSERecoveryPhase,
  SSEStatusListener
} from "./types/public";

export { createSSEClient } from "./client/create-sse-client";
export type { SSEClient, SSEClientDependencies } from "./client/create-sse-client";
export { attachLifecycleResume } from "./resume/attach-lifecycle-resume";
export type {
  LifecycleResumeOptions,
  LifecycleResumeStrategy,
  LifecycleResumeTrigger
} from "./resume/attach-lifecycle-resume";
export { createSSEParser, parseSSEChunk } from "./parser/parse-sse-chunk";
export type { ParsedSSEEvent, SSEParser } from "./parser/parse-sse-chunk";
export { calculateReconnectDelay } from "./reconnect/calculate-reconnect-delay";
export type { ReconnectDelayContext } from "./reconnect/calculate-reconnect-delay";
export { attachReconnectNotifications } from "./reconnect/attach-reconnect-notifications";
export type { ReconnectNotificationHandlers } from "./reconnect/attach-reconnect-notifications";
export { createBearerAuth } from "./auth/create-bearer-auth";
export type { BearerAuthOptions, TokenProvider } from "./auth/create-bearer-auth";
export { createFetchTransport } from "./transport/create-fetch-transport";
export type { FetchTransportOptions, SSETransport } from "./transport/create-fetch-transport";
export { createDefaultCoordinationBackend } from "./coordination/coordination-backend";
export type { CoordinationBackend, CoordinationChannel } from "./coordination/coordination-backend";
export type { CoordinationMessage } from "./coordination/coordination-message";
export { serializeSSECoordination, serializeSSEKey } from "./keys/serialize-sse-key";
