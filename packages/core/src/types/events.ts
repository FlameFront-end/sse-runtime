export type EventMap = Record<string, unknown>;

export type EventHandler<Payload> = (payload: Payload) => void | Promise<void>;

/**
 * A parsed event delivered to a wildcard observer: the event name plus its
 * parsed payload (JSON when parseable, otherwise the raw string).
 */
export type SSEEventEnvelope = {
  readonly type: string;
  readonly data: unknown;
};

/**
 * Observer invoked for every event on the stream regardless of name. Intended
 * for diagnostics/devtools. Handler errors are swallowed and never affect the
 * stream or its error state.
 */
export type SSEAnyEventHandler = (event: SSEEventEnvelope) => void | Promise<void>;
