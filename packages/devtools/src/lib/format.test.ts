import { describe, expect, it } from "vitest";
import {
  canExpandData,
  expandedData,
  fmtAgo,
  fmtData,
  fmtDuration,
  fmtTime,
  urlLabel,
  urlPath
} from "./format";

describe("fmtTime", () => {
  it("formats a timestamp as HH:MM:SS", () => {
    // Build a timestamp that round-trips to a known time in any timezone by
    // using toLocaleTimeString with the same options we use in the component.
    const ts = new Date("2024-01-15T14:05:09Z").getTime();
    const result = fmtTime(ts);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe("fmtData", () => {
  it("returns 'null' for null and '(no data)' for undefined", () => {
    expect(fmtData(null)).toBe("null");
    expect(fmtData(undefined)).toBe("(no data)");
  });

  it("returns string data as-is", () => {
    expect(fmtData("hello world")).toBe("hello world");
  });

  it("serializes objects to JSON", () => {
    expect(fmtData({ text: "hi" })).toBe('{"text":"hi"}');
  });

  it("collapses internal newlines into spaces", () => {
    expect(fmtData("line one\nline two")).toBe("line one line two");
  });

  it("collapses internal tabs and multiple spaces", () => {
    expect(fmtData("a\t\tb")).toBe("a b");
  });

  it("caps payload at 500 characters and appends ellipsis", () => {
    const long = "x".repeat(600);
    const result = fmtData(long);
    expect(result.length).toBe(503);
    expect(result.endsWith("...")).toBe(true);
  });

  it("does not truncate payloads at exactly 500 characters", () => {
    const exact = "x".repeat(500);
    expect(fmtData(exact)).toBe(exact);
  });
});

describe("urlPath", () => {
  it("extracts the pathname from a full URL", () => {
    expect(urlPath("http://localhost:3001/api/stream")).toBe("/api/stream");
  });

  it("returns the raw string when the input is not a valid URL", () => {
    expect(urlPath("/relative/path")).toBe("/relative/path");
  });
});

describe("canExpandData", () => {
  it("returns true for non-string data", () => {
    expect(canExpandData({ text: "hi" })).toBe(true);
    expect(canExpandData(42)).toBe(true);
  });

  it("returns false for null and undefined (nothing to expand)", () => {
    expect(canExpandData(null)).toBe(false);
    expect(canExpandData(undefined)).toBe(false);
  });

  it("returns false for short strings", () => {
    expect(canExpandData("short")).toBe(false);
  });

  it("returns true for strings longer than 100 characters", () => {
    expect(canExpandData("x".repeat(101))).toBe(true);
  });
});

describe("urlLabel", () => {
  it("keeps the query string so same-path connections differ", () => {
    expect(urlLabel("http://localhost/api/stream?room=1")).toBe("/api/stream?room=1");
    expect(urlLabel("http://localhost/api/stream?room=2")).toBe("/api/stream?room=2");
  });

  it("works with relative URLs", () => {
    expect(urlLabel("/api/stream?x=1")).toBe("/api/stream?x=1");
  });
});

describe("fmtAgo", () => {
  it("describes recent and older timestamps", () => {
    const now = 1_000_000;
    expect(fmtAgo(now, now)).toBe("just now");
    expect(fmtAgo(now - 5_000, now)).toBe("5s ago");
    expect(fmtAgo(now - 180_000, now)).toBe("3m ago");
    expect(fmtAgo(now - 7_200_000, now)).toBe("2h ago");
  });
});

describe("fmtDuration", () => {
  it("formats elapsed time", () => {
    const now = 10_000_000;
    expect(fmtDuration(now - 12_000, now)).toBe("12s");
    expect(fmtDuration(now - 200_000, now)).toBe("3m 20s");
    expect(fmtDuration(now - 3_840_000, now)).toBe("1h 04m");
  });
});

describe("expandedData", () => {
  it("returns a string value unchanged", () => {
    expect(expandedData("raw")).toBe("raw");
  });

  it("pretty-prints objects with 2-space indent", () => {
    expect(expandedData({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});
