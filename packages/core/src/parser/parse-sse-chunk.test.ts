import { describe, expect, it } from "vitest";

import { createSSEParser, parseSSEChunk } from "./parse-sse-chunk";

describe("parseSSEChunk", () => {
  it("parses named events with JSON payload", () => {
    expect(parseSSEChunk('event: message\ndata: {"text":"hello"}\n\n')).toEqual([
      {
        event: "message",
        data: '{"text":"hello"}',
        id: undefined,
        retry: undefined
      }
    ]);
  });

  it("parses multiple events from one chunk", () => {
    expect(parseSSEChunk("event: message\ndata: first\n\nevent: done\ndata: second\n\n")).toEqual([
      {
        event: "message",
        data: "first",
        id: undefined,
        retry: undefined
      },
      {
        event: "done",
        data: "second",
        id: undefined,
        retry: undefined
      }
    ]);
  });

  it("parses multiline data", () => {
    expect(parseSSEChunk("event: message\ndata: first\ndata: second\n\n")).toEqual([
      {
        event: "message",
        data: "first\nsecond",
        id: undefined,
        retry: undefined
      }
    ]);
  });

  it("parses id and retry fields", () => {
    expect(parseSSEChunk("id: 42\nretry: 5000\ndata: payload\n\n")).toEqual([
      {
        event: "message",
        data: "payload",
        id: "42",
        retry: 5000
      }
    ]);
  });

  it("ignores invalid retry fields", () => {
    expect(parseSSEChunk("retry: 1.5\ndata: payload\n\nretry: -1\ndata: next\n\n")).toEqual([
      {
        event: "message",
        data: "payload",
        id: undefined,
        retry: undefined
      },
      {
        event: "message",
        data: "next",
        id: undefined,
        retry: undefined
      }
    ]);
  });

  it("ignores comments and empty event blocks", () => {
    expect(parseSSEChunk(": keepalive\n\n\nevent: message\ndata: payload\n\n")).toEqual([
      {
        event: "message",
        data: "payload",
        id: undefined,
        retry: undefined
      }
    ]);
  });
});

describe("parseSSEChunk - comment and empty event edge cases", () => {
  it("returns empty array for comment-only chunk", () => {
    expect(parseSSEChunk(": ping\n: pong\n\n")).toEqual([]);
  });

  it("discards event blocks that have no data field", () => {
    expect(parseSSEChunk("event: ping\nid: 1\n\n")).toEqual([]);
  });

  it("treats field name without colon as field with empty value", () => {
    expect(parseSSEChunk("data\n\n")).toEqual([
      { event: "message", data: "", id: undefined, retry: undefined }
    ]);
  });

  it("sets id to empty string when id field has no value", () => {
    expect(parseSSEChunk("id:\ndata: hello\n\n")).toEqual([
      { event: "message", data: "hello", id: "", retry: undefined }
    ]);
  });

  it("includes empty string for empty data line in multiline join", () => {
    expect(parseSSEChunk("data:\ndata: content\n\n")).toEqual([
      { event: "message", data: "\ncontent", id: undefined, retry: undefined }
    ]);
  });
});

describe("parseSSEChunk - id field edge cases", () => {
  it("ignores id field containing a NULL character per SSE spec", () => {
    expect(parseSSEChunk("id: abc\x00def\ndata: hello\n\n")).toEqual([
      { event: "message", data: "hello", id: undefined, retry: undefined }
    ]);
  });

  it("ignores id field that is only a NULL character", () => {
    expect(parseSSEChunk("id: \x00\ndata: hello\n\n")).toEqual([
      { event: "message", data: "hello", id: undefined, retry: undefined }
    ]);
  });

  it("accepts id field with empty value", () => {
    expect(parseSSEChunk("id:\ndata: hello\n\n")).toEqual([
      { event: "message", data: "hello", id: "", retry: undefined }
    ]);
  });
});

describe("parseSSEChunk - retry field edge cases", () => {
  it("ignores retry with non-digit characters", () => {
    expect(parseSSEChunk("retry: abc\ndata: payload\n\n")).toEqual([
      { event: "message", data: "payload", id: undefined, retry: undefined }
    ]);
  });

  it("ignores retry with scientific notation", () => {
    expect(parseSSEChunk("retry: 1e3\ndata: payload\n\n")).toEqual([
      { event: "message", data: "payload", id: undefined, retry: undefined }
    ]);
  });

  it("ignores retry containing non-ASCII digits (e.g. Arabic-Indic)", () => {
    // U+0660–U+0669 are Arabic-Indic digits; \d matches them but SSE spec requires ASCII only
    expect(parseSSEChunk("retry: ٠1000\ndata: payload\n\n")).toEqual([
      { event: "message", data: "payload", id: undefined, retry: undefined }
    ]);
  });

  it("ignores retry with empty value", () => {
    expect(parseSSEChunk("retry: \ndata: payload\n\n")).toEqual([
      { event: "message", data: "payload", id: undefined, retry: undefined }
    ]);
  });

  it("ignores retry that exceeds safe integer range", () => {
    expect(parseSSEChunk(`retry: ${Number.MAX_SAFE_INTEGER + 1}\ndata: payload\n\n`)).toEqual([
      { event: "message", data: "payload", id: undefined, retry: undefined }
    ]);
  });

  it("accepts retry of zero", () => {
    expect(parseSSEChunk("retry: 0\ndata: payload\n\n")).toEqual([
      { event: "message", data: "payload", id: undefined, retry: 0 }
    ]);
  });
});

describe("parseSSEChunk - line ending normalization", () => {
  it("normalizes CRLF line endings", () => {
    expect(parseSSEChunk("event: message\r\ndata: hello\r\n\r\n")).toEqual([
      { event: "message", data: "hello", id: undefined, retry: undefined }
    ]);
  });

  it("normalizes CR-only line endings", () => {
    expect(parseSSEChunk("event: message\rdata: hello\r\r")).toEqual([
      { event: "message", data: "hello", id: undefined, retry: undefined }
    ]);
  });
});

describe("parseSSEChunk - BOM handling", () => {
  it("strips BOM from the beginning of input", () => {
    expect(parseSSEChunk("﻿data: hello\n\n")).toEqual([
      { event: "message", data: "hello", id: undefined, retry: undefined }
    ]);
  });
});

describe("createSSEParser", () => {
  it("keeps partial chunks between parse calls", () => {
    const parser = createSSEParser();

    expect(parser.parse("event: mess")).toEqual([]);
    expect(parser.parse("age\ndata: hel")).toEqual([]);
    expect(parser.parse("lo\n\n")).toEqual([
      {
        event: "message",
        data: "hello",
        id: undefined,
        retry: undefined
      }
    ]);
  });

  it("flushes a final event without a trailing blank line", () => {
    const parser = createSSEParser();

    expect(parser.parse("event: done\ndata: ok")).toEqual([]);
    expect(parser.flush()).toEqual([
      {
        event: "done",
        data: "ok",
        id: undefined,
        retry: undefined
      }
    ]);
  });

  it("strips BOM only from the first parse call", () => {
    const parser = createSSEParser();

    expect(parser.parse("﻿data: first\n\n")).toEqual([
      { event: "message", data: "first", id: undefined, retry: undefined }
    ]);
    expect(parser.parse("data: second\n\n")).toEqual([
      { event: "message", data: "second", id: undefined, retry: undefined }
    ]);
  });

  it("handles multiple blank lines between events", () => {
    const parser = createSSEParser();

    expect(parser.parse("data: first\n\n\n\ndata: second\n\n")).toEqual([
      { event: "message", data: "first", id: undefined, retry: undefined },
      { event: "message", data: "second", id: undefined, retry: undefined }
    ]);
  });
});
