import { afterEach, describe, expect, it, vi } from "vitest";

import { createFetchTransport } from "./create-fetch-transport";

describe("createFetchTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends SSE headers and forwards credentials and signal", async () => {
    const response = new Response(null);
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const result = await createFetchTransport({
      url: "/stream",
      headers: { Authorization: "Bearer token" },
      credentials: "include",
      signal: controller.signal
    });

    expect(result).toBe(response);
    expect(fetchMock).toHaveBeenCalledWith("/stream", {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-store",
        Authorization: "Bearer token"
      },
      credentials: "include",
      signal: controller.signal
    });
  });

  it("lets caller headers override the defaults", async () => {
    const fetchMock = vi.fn(async () => new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await createFetchTransport({
      url: "/stream",
      headers: { Accept: "text/plain" },
      signal: controller.signal
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/stream",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "text/plain" })
      })
    );
  });
});
