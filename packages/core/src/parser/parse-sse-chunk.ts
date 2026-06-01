export type ParsedSSEEvent = {
  readonly event: string;
  readonly data: string;
  readonly id?: string;
  readonly retry?: number;
};

export type SSEParser = {
  readonly parse: (chunk: string) => readonly ParsedSSEEvent[];
  readonly flush: () => readonly ParsedSSEEvent[];
};

const BYTE_ORDER_MARK = "﻿";

export function parseSSEChunk(chunk: string): readonly ParsedSSEEvent[] {
  const parser = createSSEParser();

  return [...parser.parse(chunk), ...parser.flush()];
}

export function createSSEParser(): SSEParser {
  let bufferedLine = "";
  let event = "message";
  let id: string | undefined;
  let retry: number | undefined;
  let isFirstChunk = true;
  const payloadLines: string[] = [];

  return {
    parse(chunk: string): readonly ParsedSSEEvent[] {
      const events: ParsedSSEEvent[] = [];
      const normalizedChunk = stripLeadingByteOrderMark(chunk);
      const lines = normalizeLineEndings(`${bufferedLine}${normalizedChunk}`).split("\n");
      bufferedLine = lines.pop() ?? "";

      for (const line of lines) {
        const parsedEvent = parseLine(line);

        if (parsedEvent) {
          events.push(parsedEvent);
        }
      }

      return events;
    },

    flush(): readonly ParsedSSEEvent[] {
      const events: ParsedSSEEvent[] = [];

      if (bufferedLine !== "") {
        const parsedEvent = parseLine(bufferedLine);
        bufferedLine = "";

        if (parsedEvent) {
          events.push(parsedEvent);
        }
      }

      const parsedEvent = dispatchEvent();

      if (parsedEvent) {
        events.push(parsedEvent);
      }

      return events;
    }
  };

  function stripLeadingByteOrderMark(chunk: string): string {
    if (!isFirstChunk) {
      return chunk;
    }

    isFirstChunk = false;

    return chunk.startsWith(BYTE_ORDER_MARK) ? chunk.slice(BYTE_ORDER_MARK.length) : chunk;
  }

  function parseLine(line: string): ParsedSSEEvent | null {
    if (line === "") {
      return dispatchEvent();
    }

    if (line.startsWith(":")) {
      return null;
    }

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
    const value = stripSingleLeadingSpace(
      separatorIndex === -1 ? "" : line.slice(separatorIndex + 1)
    );

    if (field === "event") {
      event = value;
    }

    if (field === "data") {
      payloadLines.push(value);
    }

    if (field === "id") {
      if (!value.includes("\0")) {
        id = value;
      }
    }

    if (field === "retry") {
      retry = parseRetry(value);
    }

    return null;
  }

  function dispatchEvent(): ParsedSSEEvent | null {
    if (payloadLines.length === 0) {
      resetEvent();

      return null;
    }

    const parsedEvent: ParsedSSEEvent = {
      event,
      data: payloadLines.join("\n"),
      id,
      retry
    };

    resetEvent();

    return parsedEvent;
  }

  function resetEvent(): void {
    event = "message";
    id = undefined;
    retry = undefined;
    payloadLines.length = 0;
  }
}

function stripSingleLeadingSpace(value: string): string {
  return value.startsWith(" ") ? value.slice(1) : value;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseRetry(value: string): number | undefined {
  if (!/^[0-9]+$/.test(value)) {
    return undefined;
  }

  const parsedRetry = Number(value);

  return Number.isSafeInteger(parsedRetry) ? parsedRetry : undefined;
}
