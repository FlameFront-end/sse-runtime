import { describe, expect, it, vi } from "vitest";

import { refreshAuth } from "./refresh-auth";

describe("refreshAuth", () => {
  it("returns false when no handler is provided", async () => {
    expect(await refreshAuth({})).toBe(false);
  });

  it("invokes the handler and retries by default", async () => {
    const onUnauthorized = vi.fn(async () => undefined);

    expect(await refreshAuth({ onUnauthorized })).toBe(true);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("honors retryAfterRefresh set to false", async () => {
    const onUnauthorized = vi.fn(async () => undefined);

    expect(await refreshAuth({ onUnauthorized, retryAfterRefresh: false })).toBe(false);
  });

  it("propagates a rejection from the handler", async () => {
    const refreshError = new Error("refresh failed");

    await expect(
      refreshAuth({
        onUnauthorized: async () => {
          throw refreshError;
        }
      })
    ).rejects.toBe(refreshError);
  });
});
