import { describe, expect, it, vi } from "vitest";
import type { MutableRefObject } from "react";

import { createReactClientOptions } from "./create-react-client-options";
import type { EventMap, SSEClientOptions } from "@flamefrontend/sse-runtime-core";

type Events = { readonly message: string };

function makeRef<E extends EventMap>(
  options: SSEClientOptions<E>
): MutableRefObject<SSEClientOptions<E>> {
  return { current: options };
}

describe("createReactClientOptions", () => {
  it("reads the latest handlers, headers, reconnect and auth through the ref", async () => {
    const firstHandler = vi.fn();
    const options: SSEClientOptions<Events> = {
      key: ["chat"],
      url: "/stream",
      headers: { Authorization: "Bearer 1" },
      events: { message: firstHandler },
      reconnect: { enabled: true, minDelay: 1 },
      auth: { onUnauthorized: async () => undefined, retryAfterRefresh: true }
    };
    const ref = makeRef(options);

    const result = createReactClientOptions(options, ref);

    const secondHandler = vi.fn();
    ref.current = {
      ...options,
      headers: { Authorization: "Bearer 2" },
      events: { message: secondHandler },
      reconnect: { enabled: false, minDelay: 9 },
      auth: { onUnauthorized: async () => undefined, retryAfterRefresh: false }
    };

    await result.events?.message?.("hi");

    expect(secondHandler).toHaveBeenCalledWith("hi");
    expect(firstHandler).not.toHaveBeenCalled();

    const headers = result.headers;
    expect(typeof headers === "function" ? await headers() : headers).toEqual({
      Authorization: "Bearer 2"
    });
    expect(result.reconnect?.enabled).toBe(false);
    expect(result.reconnect?.minDelay).toBe(9);
    expect(result.auth?.retryAfterRefresh).toBe(false);
  });

  it("forwards static credentials", () => {
    const options: SSEClientOptions<Events> = {
      key: ["chat"],
      url: "/stream",
      credentials: "include"
    };

    const result = createReactClientOptions(options, makeRef(options));

    expect(result.credentials).toBe("include");
  });
});
