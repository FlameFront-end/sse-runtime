export type {
  AuthOptions,
  CoordinationMode,
  CoordinationOptions,
  DiagnosticsOptions,
  EventHandler,
  EventMap,
  SSEAnyEventHandler,
  SSEEventEnvelope,
  HeartbeatOptions,
  ReconnectOptions,
  SSEClientOptions,
  SSEConnectionStatus,
  SSEError,
  SSEErrorListener,
  SSEStatusListener
} from "./types/public";

export { createSSEClient } from "./client/create-sse-client";
export type { SSEClient, SSEClientDependencies } from "./client/create-sse-client";
export { createSSEParser, parseSSEChunk } from "./parser/parse-sse-chunk";
export type { ParsedSSEEvent, SSEParser } from "./parser/parse-sse-chunk";
export { calculateReconnectDelay } from "./reconnect/calculate-reconnect-delay";
export type { ReconnectDelayContext } from "./reconnect/calculate-reconnect-delay";
export { createFetchTransport } from "./transport/create-fetch-transport";
export type { FetchTransportOptions, SSETransport } from "./transport/create-fetch-transport";
export { createDefaultCoordinationBackend } from "./coordination/coordination-backend";
export type { CoordinationBackend, CoordinationChannel } from "./coordination/coordination-backend";
export type { CoordinationMessage } from "./coordination/coordination-message";
export { serializeSSECoordination, serializeSSEKey } from "./keys/serialize-sse-key";
