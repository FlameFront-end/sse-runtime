// @vitest-environment jsdom

import { render, act } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { SSEProvider } from "../components/sse-provider";
import { useSSEContext } from "./use-sse-context";
import { useSSEEvent } from "./use-sse-event";
import { useSSEStatus } from "./use-sse-status";
import type {
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

type ChatEvents = {
  readonly message: { readonly text: string };
};

describe("SSEProvider", () => {
  it("renders children", () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);

    const { getByText } = render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <span>child content</span>
      </SSEProvider>
    );

    expect(getByText("child content")).toBeDefined();
  });

  it("calls connect on mount", async () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);

    render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <span />
      </SSEProvider>
    );

    expect(client.connect).toHaveBeenCalledTimes(1);
  });

  it("does not call connect when enabled is false", () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);

    render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream", enabled: false }}>
        <span />
      </SSEProvider>
    );

    expect(client.connect).not.toHaveBeenCalled();
  });
});

describe("useSSEContext", () => {
  it("throws when called outside SSEProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    function BadComponent(): ReactElement {
      useSSEContext<ChatEvents>();
      return <span />;
    }

    expect(() => render(<BadComponent />)).toThrow(
      "useSSEContext must be called inside an SSEProvider"
    );

    consoleError.mockRestore();
  });
});

describe("useSSEEvent", () => {
  it("subscribes to the named event via subscribeEvent", async () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);
    const received: ChatEvents["message"][] = [];

    function TestComponent(): ReactElement {
      const connection = useSSEContext<ChatEvents>();
      useSSEEvent(connection, "message", (payload) => void received.push(payload));
      return <span />;
    }

    render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent />
      </SSEProvider>
    );

    expect(client.subscribeEvent).toHaveBeenCalledWith("message", expect.any(Function));

    act(() => client.emitEvent("message", { text: "hello" }));

    expect(received).toEqual([{ text: "hello" }]);
  });

  it("always calls the latest handler without resubscribing", async () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    function TestComponent(props: { readonly version: number }): ReactElement {
      const connection = useSSEContext<ChatEvents>();
      useSSEEvent(connection, "message", props.version === 1 ? firstHandler : secondHandler);
      return <span />;
    }

    const view = render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent version={1} />
      </SSEProvider>
    );

    expect(client.subscribeEvent).toHaveBeenCalledTimes(1);

    view.rerender(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent version={2} />
      </SSEProvider>
    );

    // Handler changed but no new subscription
    expect(client.subscribeEvent).toHaveBeenCalledTimes(1);

    act(() => client.emitEvent("message", { text: "hi" }));

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledWith({ text: "hi" });
  });

  it("unsubscribes on unmount", () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);

    function TestComponent(): ReactElement {
      const connection = useSSEContext<ChatEvents>();
      useSSEEvent(connection, "message", vi.fn());
      return <span />;
    }

    const { unmount } = render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent />
      </SSEProvider>
    );

    unmount();

    expect(client.unsubscribeEvent).toHaveBeenCalledTimes(1);
  });
});

describe("useSSEStatus", () => {
  it("returns current status and error", () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);
    let capturedStatus: SSEConnectionStatus | undefined;

    function TestComponent(): ReactElement {
      const connection = useSSEContext<ChatEvents>();
      const { status } = useSSEStatus(connection);
      capturedStatus = status;
      return <span />;
    }

    render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent />
      </SSEProvider>
    );

    expect(capturedStatus).toBe("closed");
  });

  it("updates when status changes", async () => {
    const client = createFakeClient();
    createSSEClient.mockReturnValue(client);
    const statuses: SSEConnectionStatus[] = [];

    function TestComponent(): ReactElement {
      const connection = useSSEContext<ChatEvents>();
      const { status } = useSSEStatus(connection);
      statuses.push(status);
      return <span>{status}</span>;
    }

    render(
      <SSEProvider<ChatEvents> options={{ key: ["chat"], url: "/stream" }}>
        <TestComponent />
      </SSEProvider>
    );

    act(() => client.emitStatus("open"));

    expect(statuses).toContain("open");
  });
});

type FakeClient = {
  readonly connect: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly disconnect: ReturnType<typeof vi.fn<() => void>>;
  readonly getError: () => null;
  readonly getStatus: () => SSEConnectionStatus;
  readonly subscribeError: (listener: SSEErrorListener) => () => void;
  readonly subscribeStatus: (listener: SSEStatusListener) => () => void;
  readonly subscribeEvent: ReturnType<typeof vi.fn>;
  readonly unsubscribeEvent: ReturnType<typeof vi.fn>;
  readonly emitEvent: (eventName: string, payload: unknown) => void;
  readonly emitStatus: (status: SSEConnectionStatus) => void;
};

function createFakeClient(): FakeClient {
  let status: SSEConnectionStatus = "closed";
  const statusListeners = new Set<SSEStatusListener>();
  const errorListeners = new Set<SSEErrorListener>();
  const eventListeners = new Map<string, Set<(payload: unknown) => void>>();
  const unsubscribeEvent = vi.fn();

  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    getError: () => null,
    getStatus: () => status,
    subscribeStatus(listener: SSEStatusListener): () => void {
      statusListeners.add(listener);
      listener(status);
      return () => statusListeners.delete(listener);
    },
    subscribeError(listener: SSEErrorListener): () => void {
      errorListeners.add(listener);
      listener(null);
      return () => errorListeners.delete(listener);
    },
    subscribeEvent: vi.fn((eventName: string, handler: (payload: unknown) => void) => {
      if (!eventListeners.has(eventName)) {
        eventListeners.set(eventName, new Set());
      }
      eventListeners.get(eventName)!.add(handler);
      return () => {
        eventListeners.get(eventName)?.delete(handler);
        unsubscribeEvent();
      };
    }),
    unsubscribeEvent,
    emitEvent(eventName: string, payload: unknown): void {
      eventListeners.get(eventName)?.forEach((handler) => handler(payload));
    },
    emitStatus(nextStatus: SSEConnectionStatus): void {
      status = nextStatus;
      statusListeners.forEach((listener) => listener(nextStatus));
    }
  };
}
