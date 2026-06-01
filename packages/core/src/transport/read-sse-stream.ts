import { createTransportError } from "../errors/sse-error";
import { createSSEParser, type ParsedSSEEvent } from "../parser/parse-sse-chunk";
import type { SSEError } from "../types/public";

export type ReadSSEStreamOptions = {
  readonly stream: ReadableStream<Uint8Array>;
  readonly signal: AbortSignal;
  readonly createTextDecoder: () => TextDecoder;
  readonly onEvents: (events: readonly ParsedSSEEvent[]) => Promise<void>;
  readonly heartbeatTimeout?: number;
};

export async function readSSEStream(options: ReadSSEStreamOptions): Promise<SSEError | null> {
  const parser = createSSEParser();
  const textDecoder = options.createTextDecoder();
  const reader = options.stream.getReader();

  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  const heartbeatController = options.heartbeatTimeout !== undefined ? new AbortController() : null;

  const signal =
    heartbeatController !== null
      ? combineSignals(options.signal, heartbeatController.signal)
      : options.signal;

  function resetHeartbeat(): void {
    if (heartbeatController === null || options.heartbeatTimeout === undefined) return;
    clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => heartbeatController.abort(), options.heartbeatTimeout);
  }

  resetHeartbeat();

  try {
    while (!signal.aborted) {
      const chunk = await readChunk({ reader, signal });

      if (chunk === null) {
        if (heartbeatController?.signal.aborted) {
          return createTransportError("SSE heartbeat timeout");
        }
        return null;
      }

      if (chunk.done) {
        if (options.signal.aborted) {
          return null;
        }

        await flushDecoder(parser, textDecoder, options.onEvents);

        return createTransportError("SSE stream closed unexpectedly");
      }

      clearTimeout(heartbeatTimer);
      await options.onEvents(parser.parse(textDecoder.decode(chunk.value, { stream: true })));
      resetHeartbeat();
    }

    if (heartbeatController?.signal.aborted) {
      return createTransportError("SSE heartbeat timeout");
    }
    return null;
  } finally {
    clearTimeout(heartbeatTimer);
    reader.releaseLock();
  }
}

type ReadChunkOptions = {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly signal: AbortSignal;
};

async function readChunk(
  options: ReadChunkOptions
): Promise<ReadableStreamReadResult<Uint8Array> | null> {
  if (options.signal.aborted) {
    await options.reader.cancel(options.signal.reason);
    return null;
  }

  let removeAbortListener: () => void = () => undefined;
  const abortPromise = new Promise<null>((resolve, reject) => {
    const abortReader = (): void => {
      removeAbortListener();
      options.reader.cancel(options.signal.reason).then(() => resolve(null), reject);
    };

    removeAbortListener = () => {
      options.signal.removeEventListener("abort", abortReader);
    };
    options.signal.addEventListener("abort", abortReader, { once: true });
  });
  const readPromise = options.reader.read().finally(() => {
    removeAbortListener();
  });

  readPromise.catch(() => undefined);

  return Promise.race([readPromise, abortPromise]);
}

function combineSignals(first: AbortSignal, second: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([first, second]);
  }

  const controller = new AbortController();

  const forwardAbort = (source: AbortSignal): void => {
    controller.abort(source.reason);
  };

  if (first.aborted) {
    forwardAbort(first);
  } else if (second.aborted) {
    forwardAbort(second);
  } else {
    first.addEventListener("abort", () => forwardAbort(first), { once: true });
    second.addEventListener("abort", () => forwardAbort(second), { once: true });
  }

  return controller.signal;
}

async function flushDecoder(
  parser: ReturnType<typeof createSSEParser>,
  textDecoder: TextDecoder,
  onEvents: (events: readonly ParsedSSEEvent[]) => Promise<void>
): Promise<void> {
  const remainingText = textDecoder.decode();

  if (remainingText !== "") {
    await onEvents(parser.parse(remainingText));
  }

  await onEvents(parser.flush());
}
