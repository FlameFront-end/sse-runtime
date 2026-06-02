import { describe, expect, it, vi } from "vitest";

import { createBearerAuth } from "./create-bearer-auth";

describe("createBearerAuth", () => {
  it("adds an Authorization header from the token", async () => {
    const { headers } = createBearerAuth(() => "abc");
    expect(await headers()).toEqual({ Authorization: "Bearer abc" });
  });

  it("awaits async token providers and merges extra headers", async () => {
    const { headers } = createBearerAuth(async () => "xyz", { headers: { "X-Trace": "1" } });
    expect(await headers()).toEqual({ "X-Trace": "1", Authorization: "Bearer xyz" });
  });

  it("omits Authorization when no token is available", async () => {
    const { headers } = createBearerAuth(() => null, { headers: { "X-Trace": "1" } });
    expect(await headers()).toEqual({ "X-Trace": "1" });
  });

  it("supports a custom scheme", async () => {
    const { headers } = createBearerAuth(() => "t", { scheme: "Token" });
    expect(await headers()).toEqual({ Authorization: "Token t" });
  });

  it("refreshes via getToken on 401 and enables retry", async () => {
    const getToken = vi.fn(() => "t");
    const { auth } = createBearerAuth(getToken);

    expect(auth.retryAfterRefresh).toBe(true);
    await auth.onUnauthorized?.();
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it("uses a custom onUnauthorized when provided", async () => {
    const onUnauthorized = vi.fn(async () => undefined);
    const getToken = vi.fn(() => "t");
    const { auth } = createBearerAuth(getToken, { onUnauthorized });

    await auth.onUnauthorized?.();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(getToken).not.toHaveBeenCalled();
  });
});
