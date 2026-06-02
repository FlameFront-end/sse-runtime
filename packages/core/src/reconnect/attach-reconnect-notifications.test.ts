import { describe, expect, it, vi } from "vitest";

import { attachReconnectNotifications } from "./attach-reconnect-notifications";
import type { SSEClient } from "../client/create-local-sse-client";
import type { SSEConnectionStatus, SSEStatusListener } from "../types/public";

function createFakeClient() {
  let listener: SSEStatusListener | null = null;
  const client = {
    subscribeStatus(next: SSEStatusListener): () => void {
      listener = next;
      return () => {
        listener = null;
      };
    }
  } as unknown as SSEClient;

  return {
    client,
    emit: (status: SSEConnectionStatus): void => listener?.(status),
    isAttached: (): boolean => listener !== null
  };
}

describe("attachReconnectNotifications", () => {
  it("reports a full reconnect cycle", () => {
    const fake = createFakeClient();
    const onReconnecting = vi.fn();
    const onReconnected = vi.fn();
    const onFailed = vi.fn();
    attachReconnectNotifications(fake.client, { onReconnecting, onReconnected, onFailed });

    fake.emit("open");
    fake.emit("reconnecting");
    fake.emit("connecting");
    fake.emit("open");

    expect(onReconnecting).toHaveBeenCalledTimes(1);
    expect(onReconnected).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("does not report the initial connect as a reconnect", () => {
    const fake = createFakeClient();
    const onReconnected = vi.fn();
    attachReconnectNotifications(fake.client, { onReconnected });

    fake.emit("connecting");
    fake.emit("open");

    expect(onReconnected).not.toHaveBeenCalled();
  });

  it("reports a terminal failure", () => {
    const fake = createFakeClient();
    const onFailed = vi.fn();
    const onReconnected = vi.fn();
    attachReconnectNotifications(fake.client, { onFailed, onReconnected });

    fake.emit("reconnecting");
    fake.emit("error");

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onReconnected).not.toHaveBeenCalled();
  });

  it("collapses repeated reconnecting transitions", () => {
    const fake = createFakeClient();
    const onReconnecting = vi.fn();
    attachReconnectNotifications(fake.client, { onReconnecting });

    fake.emit("reconnecting");
    fake.emit("reconnecting");

    expect(onReconnecting).toHaveBeenCalledTimes(1);
  });

  it("treats a manual close during reconnect as silent", () => {
    const fake = createFakeClient();
    const onFailed = vi.fn();
    attachReconnectNotifications(fake.client, { onFailed });

    fake.emit("reconnecting");
    fake.emit("closed");
    fake.emit("connecting");
    fake.emit("open");

    expect(onFailed).not.toHaveBeenCalled();
  });

  it("detaches on cleanup", () => {
    const fake = createFakeClient();
    const detach = attachReconnectNotifications(fake.client, {});

    expect(fake.isAttached()).toBe(true);
    detach();
    expect(fake.isAttached()).toBe(false);
  });
});
