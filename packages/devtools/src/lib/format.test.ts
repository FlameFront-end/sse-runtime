import { describe, expect, it } from "vitest";
import { canExpandData, expandedData, fmtData, fmtTime, urlPath } from "./format";

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
  it("returns 'null' for null/undefined", () => {
    expect(fmtData(null)).toBe("null");
    expect(fmtData(undefined)).toBe("null");
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
    expect(canExpandData(null)).toBe(true);
  });

  it("returns false for short strings", () => {
    expect(canExpandData("short")).toBe(false);
  });

  it("returns true for strings longer than 100 characters", () => {
    expect(canExpandData("x".repeat(101))).toBe(true);
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
