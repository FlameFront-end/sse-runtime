// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSSE } from "./use-sse";
import type {
  EventMap,
  SSEClientOptions,
  SSEConnectionStatus,
  SSEErrorListener,
  SSEStatusListener
} from "@flamefrontend/sse-runtime-core";

const createSSEClient = vi.hoisted(() => vi.fn());

vi.mock("@flamefrontend/sse-runtime-core", () => ({
  createSSEClient,
  serializeSSECoordination: (value: unknown) => JSON.stringify(value ?? null),
  serializeSSEKey: (key: readonly string[]) => JSON.stringify(key)
}));

describe("useSSE", () => {
  beforeEach(() => {
    createSSEClient.mockReset();
  });

  it("does not recreate the client after status updates with inline options", async () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);

    function TestComponent(): ReactElement {
      const connection = useSSE({
        key: ["chat", "demo"],
        url: "/stream",
        events: {
          message: () => undefined
        }
      });

      return <span>{connection.status}</span>;
    }

    render(<TestComponent />);

    await waitFor(() => expect(client.connect).toHaveBeenCalledTimes(1));
    client.emit("open");
    await waitFor(() => expect(createSSEClient).toHaveBeenCalledTimes(1));

    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("uses latest dynamic options without recreating the client", async () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const firstUnauthorized = vi.fn(async () => undefined);
    const secondUnauthorized = vi.fn(async () => undefined);

    function TestComponent(props: { readonly version: number }): ReactElement {
      useSSE<{ readonly message: string }>({
        key: ["chat", "demo"],
        url: "/stream",
        headers: {
          Authorization: `Bearer ${props.version}`
        },
        events: {
          message: props.version === 1 ? firstHandler : secondHandler
        },
        reconnect: {
          enabled: props.version === 1,
          minDelay: props.version
        },
        auth: {
          onUnauthorized: props.version === 1 ? firstUnauthorized : secondUnauthorized,
          retryAfterRefresh: props.version === 1
        }
      });

      return <span>{props.version}</span>;
    }

    const view = render(<TestComponent version={1} />);
    const clientOptions = getClientOptions<{ readonly message: string }>();

    view.rerender(<TestComponent version={2} />);

    await clientOptions.events?.message?.("payload");
    await clientOptions.auth?.onUnauthorized?.();

    expect(createSSEClient).toHaveBeenCalledTimes(1);
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith("payload");
    expect(await resolveHeaders(clientOptions)).toEqual({ Authorization: "Bearer 2" });
    expect(firstUnauthorized).not.toHaveBeenCalled();
    expect(secondUnauthorized).toHaveBeenCalledTimes(1);
    expect(clientOptions.reconnect?.enabled).toBe(false);
    expect(clientOptions.reconnect?.minDelay).toBe(2);
    expect(clientOptions.auth?.retryAfterRefresh).toBe(false);
    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it("exposes the client, ensureOpen, and reconnect from the result", async () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);
    let captured: ReturnType<typeof useSSE> | undefined;

    function TestComponent(): ReactElement {
      captured = useSSE({ key: ["chat", "demo"], url: "/stream" });
      return <span />;
    }

    render(<TestComponent />);

    await waitFor(() => expect(client.connect).toHaveBeenCalledTimes(1));

    expect(captured?.client).toBe(client);

    await captured?.reconnect();
    expect(client.reconnect).toHaveBeenCalledTimes(1);

    await captured?.ensureOpen({ timeout: 1000 });
    expect(client.ensureOpen).toHaveBeenCalledWith({ timeout: 1000 });
  });

  it("recreates the client when enabled changes", async () => {
    const firstClient = createFakeClient();
    const secondClient = createFakeClient();
    createSSEClient.mockReturnValueOnce(firstClient).mockReturnValueOnce(secondClient);

    function TestComponent(props: { readonly enabled: boolean }): ReactElement {
      const connection = useSSE({
        key: ["chat", "demo"],
        url: "/stream",
        enabled: props.enabled
      });

      return <span>{connection.status}</span>;
    }

    const view = render(<TestComponent enabled={false} />);
    view.rerender(<TestComponent enabled={true} />);

    await waitFor(() => expect(secondClient.connect).toHaveBeenCalledTimes(1));

    expect(createSSEClient).toHaveBeenCalledTimes(2);
    expect(firstClient.connect).not.toHaveBeenCalled();
  });

  it("recreates the client when transport-level options change", async () => {
    const firstClient = createFakeClient();
    const secondClient = createFakeClient();
    const thirdClient = createFakeClient();
    createSSEClient
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient)
      .mockReturnValueOnce(thirdClient);

    function TestComponent(props: {
      readonly credentials: RequestCredentials;
      readonly hasCoordination: boolean;
    }): ReactElement {
      useSSE({
        key: ["chat", "demo"],
        url: "/stream",
        credentials: props.credentials,
        coordination: props.hasCoordination ? { enabled: true, mode: "single-tab" } : undefined
      });

      return <span>{props.credentials}</span>;
    }

    const view = render(<TestComponent credentials="same-origin" hasCoordination={false} />);
    view.rerender(<TestComponent credentials="include" hasCoordination={false} />);
    view.rerender(<TestComponent credentials="include" hasCoordination={true} />);

    await waitFor(() => expect(thirdClient.connect).toHaveBeenCalledTimes(1));

    expect(createSSEClient).toHaveBeenCalledTimes(3);
    expect(firstClient.disconnect).toHaveBeenCalledTimes(1);
    expect(secondClient.disconnect).toHaveBeenCalledTimes(1);
  });
});

function getClientOptions<Events extends EventMap>(): SSEClientOptions<Events> {
  const firstCall = createSSEClient.mock.calls[0]?.[0];

  if (!firstCall) {
    throw new Error("SSE client options were not captured");
  }

  return firstCall as SSEClientOptions<Events>;
}

async function resolveHeaders<Events extends EventMap>(
  options: SSEClientOptions<Events>
): Promise<Record<string, string> | undefined> {
  const headers = options.headers;

  return typeof headers === "function" ? headers() : headers;
}

function createFakeClient(): {
  readonly connect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly disconnect: ReturnType<typeof vi.fn<() => void>>;
  readonly reconnect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly ensureOpen: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  readonly getError: () => null;
  readonly getStatus: () => SSEConnectionStatus;
  readonly subscribeError: (listener: SSEErrorListener) => () => void;
  readonly subscribeStatus: (listener: SSEStatusListener) => () => void;
  readonly subscribeAnyEvent: ReturnType<typeof vi.fn>;
  readonly emit: (status: SSEConnectionStatus) => void;
} {
  let status: SSEConnectionStatus = "closed";
  const error = null;
  const errorListeners = new Set<SSEErrorListener>();
  const listeners = new Set<SSEStatusListener>();

  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    reconnect: vi.fn(async () => undefined),
    ensureOpen: vi.fn(async () => true),
    subscribeAnyEvent: vi.fn(() => () => undefined),
    getError: () => error,
    getStatus: () => status,
    subscribeError(listener: SSEErrorListener): () => void {
      errorListeners.add(listener);
      listener(error);

      return () => {
        errorListeners.delete(listener);
      };
    },
    subscribeStatus(listener: SSEStatusListener): () => void {
      listeners.add(listener);
      listener(status);

      return () => {
        listeners.delete(listener);
      };
    },
    emit(nextStatus: SSEConnectionStatus): void {
      status = nextStatus;
      listeners.forEach((listener) => listener(nextStatus));
    }
  };
}
