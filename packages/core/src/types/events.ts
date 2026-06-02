export type EventMap = Record<string, unknown>;

export type EventHandler<Payload> = (payload: Payload) => void | Promise<void>;

export type SSEEventEnvelope = {
  readonly type: string;
  readonly data: unknown;
  readonly raw: string;
};

/**
 * Observer invoked for every event on the stream regardless of name. Intended
 * for diagnostics/devtools. Handler errors are swallowed and never affect the
 * stream or its error state.
 */
export type SSEAnyEventHandler = (event: SSEEventEnvelope) => void | Promise<void>;
