import { describe, expect, it } from "vitest";

import { serializeSSECoordination, serializeSSEKey } from "./serialize-sse-key";

describe("serializeSSEKey", () => {
  it("serializes a key array to a stable string", () => {
    expect(serializeSSEKey(["chat", "42"])).toBe('["chat","42"]');
  });

  it("produces distinct strings for differently shaped keys", () => {
    expect(serializeSSEKey(["a", "b"])).not.toBe(serializeSSEKey(["ab"]));
  });

  it("serializes absent coordination options as null", () => {
    expect(serializeSSECoordination(undefined)).toBe("null");
  });
});
