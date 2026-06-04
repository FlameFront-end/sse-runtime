import type { FetchTransportOptions, SSETransport } from "@flamefrontend/sse-runtime-core";

export type ReactNativeXHRTransportOptions = {
  readonly createXMLHttpRequest?: () => XMLHttpRequest;
  readonly encodeText?: (text: string) => Uint8Array;
  readonly headers?: Record<string, string>;
};

const DEFAULT_SSE_HEADERS: Record<string, string> = {
  Accept: "text/event-stream",
  "Cache-Control": "no-store"
};

const XHR_HEADERS_RECEIVED = 2;
const XHR_DONE = 4;

export function createReactNativeXHRTransport(
  options: ReactNativeXHRTransportOptions = {}
): SSETransport {
  const createXMLHttpRequest =
    options.createXMLHttpRequest ??
    (() => {
      if (typeof XMLHttpRequest === "undefined") {
        throw new Error("XMLHttpRequest is not available in this runtime");
      }

      return new XMLHttpRequest();
    });
  const encodeText = options.encodeText ?? encodeUTF8;
  const defaultHeaders = { ...DEFAULT_SSE_HEADERS, ...options.headers };

  return (transportOptions) =>
    createTransportResponse({
      createXMLHttpRequest,
      defaultHeaders,
      encodeText,
      transportOptions
    });
}

type CreateTransportResponseOptions = {
  readonly createXMLHttpRequest: () => XMLHttpRequest;
  readonly defaultHeaders: Record<string, string>;
  readonly encodeText: (text: string) => Uint8Array;
  readonly transportOptions: FetchTransportOptions;
};

function createTransportResponse({
  createXMLHttpRequest,
  defaultHeaders,
  encodeText,
  transportOptions
}: CreateTransportResponseOptions): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const xhr = createXMLHttpRequest();
    const byteStream = createIncrementalByteStream(() => xhr.abort());
    let hasSettled = false;
    let lastProcessedLength = 0;

    const settleResponse = (): void => {
      if (hasSettled) {
        return;
      }

      hasSettled = true;
      resolve(createXHRResponse(xhr, byteStream.readable));
    };

    const rejectResponse = (cause: Error): void => {
      if (hasSettled) {
        byteStream.error(cause);
        return;
      }

      hasSettled = true;
      reject(cause);
    };

    const abortRequest = (): void => {
      xhr.abort();
      rejectResponse(new Error("SSE request aborted"));
    };

    if (transportOptions.signal.aborted) {
      abortRequest();
      return;
    }

    transportOptions.signal.addEventListener("abort", abortRequest, { once: true });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XHR_HEADERS_RECEIVED) {
        settleResponse();
        return;
      }

      if (xhr.readyState === XHR_DONE) {
        byteStream.close();
      }
    };
    xhr.onprogress = () => {
      settleResponse();

      const responseText = xhr.responseText ?? "";
      if (responseText.length <= lastProcessedLength) {
        return;
      }

      const nextText = responseText.slice(lastProcessedLength);
      lastProcessedLength = responseText.length;
      byteStream.enqueue(encodeText(nextText));
    };
    xhr.onerror = () => {
      rejectResponse(new Error("XMLHttpRequest reported an SSE transport error"));
    };
    xhr.onabort = () => {
      rejectResponse(new Error("SSE request aborted"));
    };

    xhr.open("GET", transportOptions.url, true);
    xhr.withCredentials = transportOptions.credentials === "include";
    setHeaders(xhr, { ...defaultHeaders, ...transportOptions.headers });
    xhr.send();
  });
}

function setHeaders(xhr: XMLHttpRequest, headers: Record<string, string>): void {
  for (const [name, value] of Object.entries(headers)) {
    xhr.setRequestHeader(name, value);
  }
}

function createXHRResponse(xhr: XMLHttpRequest, body: ReadableStream<Uint8Array>): Response {
  return {
    body,
    ok: xhr.status >= 200 && xhr.status < 300,
    status: xhr.status
  } as Response;
}

type IncrementalByteStream = {
  readonly readable: ReadableStream<Uint8Array>;
  readonly close: () => void;
  readonly enqueue: (chunk: Uint8Array) => void;
  readonly error: (cause: Error) => void;
};

function createIncrementalByteStream(cancel: () => void): IncrementalByteStream {
  const chunks: Uint8Array[] = [];
  const pendingReads: Array<{
    readonly resolve: (result: ReadableStreamReadResult<Uint8Array>) => void;
    readonly reject: (cause: Error) => void;
  }> = [];
  let error: Error | null = null;
  let isClosed = false;
  let isLocked = false;

  const readable = {
    getReader(): ReadableStreamDefaultReader<Uint8Array> {
      if (isLocked) {
        throw new TypeError("ReadableStream is already locked");
      }

      isLocked = true;

      return {
        cancel(reason?: unknown): Promise<void> {
          error = reason instanceof Error ? reason : null;
          isClosed = true;
          chunks.length = 0;
          cancel();
          flushPendingReads();

          return Promise.resolve();
        },
        read(): Promise<ReadableStreamReadResult<Uint8Array>> {
          if (error) {
            return Promise.reject(error);
          }

          const chunk = chunks.shift();
          if (chunk) {
            return Promise.resolve({ done: false, value: chunk });
          }

          if (isClosed) {
            return Promise.resolve({ done: true, value: undefined });
          }

          return new Promise((resolve, reject) => {
            pendingReads.push({ resolve, reject });
          });
        },
        releaseLock(): void {
          isLocked = false;
        }
      } as ReadableStreamDefaultReader<Uint8Array>;
    }
  } as ReadableStream<Uint8Array>;

  return {
    readable,
    close(): void {
      isClosed = true;
      flushPendingReads();
    },
    enqueue(chunk: Uint8Array): void {
      if (isClosed || error) {
        return;
      }

      const pendingRead = pendingReads.shift();
      if (pendingRead) {
        pendingRead.resolve({ done: false, value: chunk });
        return;
      }

      chunks.push(chunk);
    },
    error(cause: Error): void {
      error = cause;
      flushPendingReads();
    }
  };

  function flushPendingReads(): void {
    while (pendingReads.length > 0) {
      const pendingRead = pendingReads.shift()!;

      if (error) {
        pendingRead.reject(error);
      } else {
        pendingRead.resolve({ done: true, value: undefined });
      }
    }
  }
}

function encodeUTF8(text: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text);
  }

  const bytes: number[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.codePointAt(index)!;

    if (codePoint > 0xffff) {
      index += 1;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }

  return new Uint8Array(bytes);
}
