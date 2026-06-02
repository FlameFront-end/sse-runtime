// @vitest-environment jsdom

import { render, act } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { SSEProvider } from "../components/sse-provider";
import { useSSEAnyEvent } from "./use-sse-any-event";
import { useSSEContext } from "./use-sse-context";
import type {
  SSEAnyEventHandler,
  SSEConnectionStatus,
  SSEErrorListener,
  SSEEventEnvelope,
  SSEStatusListener
} from "@flamefrontend/sse-runtime-core";

const createSSEClient = vi.hoisted(() => vi.fn());

vi.mock("@flamefrontend/sse-runtime-core", () => ({
  createSSEClient,
  serializeSSECoordination: (value: unknown) => JSON.stringify(value ?? null),
  serializeSSEKey: (key: readonly string[]) => JSON.stringify(key)
}));

type ChatEvents = {
  readonly message: { readonly text: string };
};

describe("useSSEAnyEvent", () => {
  it("subscribes to every event via subscribeAnyEvent", () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);
    const received: SSEEventEnvelope[] = [];

    function TestComponent(): ReactElement {
      const connection = useSSEContext<ChatEvents>();
      useSSEAnyEvent(connection, (event) => void received.push(event));
      return <span />;
    }

    render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent />
      </SSEProvider>
    );

    expect(client.subscribeAnyEvent).toHaveBeenCalledTimes(1);

    act(() => client.emitAnyEvent({ type: "message", data: { text: "hi" } }));

    expect(received).toEqual([{ type: "message", data: { text: "hi" } }]);
  });

  it("always calls the latest handler without resubscribing", () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    function TestComponent(props: { readonly version: number }): ReactElement {
      const connection = useSSEContext<ChatEvents>();
      useSSEAnyEvent(connection, props.version === 1 ? firstHandler : secondHandler);
      return <span />;
    }

    const view = render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent version={1} />
      </SSEProvider>
    );

    view.rerender(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent version={2} />
      </SSEProvider>
    );

    expect(client.subscribeAnyEvent).toHaveBeenCalledTimes(1);

    act(() => client.emitAnyEvent({ type: "message", data: { text: "hi" } }));

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith({ type: "message", data: { text: "hi" } });
  });

  it("unsubscribes on unmount", () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);

    function TestComponent(): ReactElement {
      const connection = useSSEContext<ChatEvents>();
      useSSEAnyEvent(connection, vi.fn());
      return <span />;
    }

    const { unmount } = render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent />
      </SSEProvider>
    );

    unmount();

    expect(client.unsubscribeAnyEvent).toHaveBeenCalledTimes(1);
  });
});

type FakeClient = {
  readonly connect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly disconnect: ReturnType<typeof vi.fn<() => void>>;
  readonly reconnect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly ensureOpen: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  readonly getError: () => null;
  readonly getStatus: () => SSEConnectionStatus;
  readonly subscribeError: (listener: SSEErrorListener) => () => void;
  readonly subscribeStatus: (listener: SSEStatusListener) => () => void;
  readonly subscribeEvent: ReturnType<typeof vi.fn>;
  readonly subscribeAnyEvent: ReturnType<typeof vi.fn>;
  readonly unsubscribeAnyEvent: ReturnType<typeof vi.fn>;
  readonly emitAnyEvent: (event: SSEEventEnvelope) => void;
};

function createFakeClient(): FakeClient {
  const status: SSEConnectionStatus = "closed";
  const anyEventHandlers = new Set<SSEAnyEventHandler>();
  const unsubscribeAnyEvent = vi.fn();

  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    reconnect: vi.fn(async () => undefined),
    ensureOpen: vi.fn(async () => true),
    getError: () => null,
    getStatus: () => status,
    subscribeStatus(listener: SSEStatusListener): () => void {
      listener(status);
      return () => undefined;
    },
    subscribeError(listener: SSEErrorListener): () => void {
      listener(null);
      return () => undefined;
    },
    subscribeEvent: vi.fn(() => () => undefined),
    subscribeAnyEvent: vi.fn((handler: SSEAnyEventHandler) => {
      anyEventHandlers.add(handler);
      return () => {
        anyEventHandlers.delete(handler);
        unsubscribeAnyEvent();
      };
    }),
    unsubscribeAnyEvent,
    emitAnyEvent(event: SSEEventEnvelope): void {
      anyEventHandlers.forEach((handler) => void handler(event));
    }
  };
}
