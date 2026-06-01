import { describe, expect, it, vi } from "vitest";

import { createSSEClientState } from "./client-state";

describe("createSSEClientState", () => {
  it("notifies status listeners only when status changes", () => {
    const state = createSSEClientState("closed");
    const listener = vi.fn();

    state.subscribeStatus(listener);
    state.setStatus("closed");
    state.setStatus("connecting");

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith("connecting");
  });

  it("notifies error listeners only when error changes", () => {
    const state = createSSEClientState("closed");
    const listener = vi.fn();
    const error = {
      kind: "transport" as const,
      message: "failed"
    };

    state.subscribeError(listener);
    state.setError(error);
    state.setError(error);
    state.resetError();

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenLastCalledWith(null);
  });
});
