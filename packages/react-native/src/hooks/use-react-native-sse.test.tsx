// @vitest-environment jsdom

import { createSSEClient, type SSEClient } from "@flamefrontend/sse-runtime-core";
import type { SSEConnectionStatus } from "@flamefrontend/sse-runtime-core";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ReactNativeSSEProvider,
  useReactNativeSSE,
  useReactNativeSSEContext
} from "./use-react-native-sse";
import { ReactNativeSSEDevtoolsRegistrationContext } from "../devtools/devtools-registration-context";

vi.mock("@flamefrontend/sse-runtime-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@flamefrontend/sse-runtime-core")>();

  return {
    ...actual,
    createSSEClient: vi.fn()
  };
});

describe("useReactNativeSSE", () => {
  beforeEach(() => {
    vi.mocked(createSSEClient).mockReset();
    vi.mocked(createSSEClient).mockReturnValue(createClient());
  });

  it("passes runtime dependencies to createSSEClient", async () => {
    const transport = vi.fn();
    const createTextDecoder = vi.fn(() => new TextDecoder());

    render(<HookProbe dependencies={{ transport, createTextDecoder }} />);

    await waitFor(() => {
      expect(createSSEClient).toHaveBeenCalledWith(
        expect.objectContaining({ url: "/stream" }),
        expect.objectContaining({ transport, createTextDecoder })
      );
    });
  });

  it("keeps the client stable across rerenders without dependencies", () => {
    const options = createOptions();
    const view = render(<HookProbe options={options} />);

    view.rerender(<HookProbe options={options} />);

    expect(createSSEClient).toHaveBeenCalledTimes(1);
  });

  it("provides a client through ReactNativeSSEProvider", async () => {
    const client = createClient();
    vi.mocked(createSSEClient).mockReturnValue(client);
    const onClient = vi.fn();

    render(
      <ReactNativeSSEProvider options={createOptions()} dependencies={{ wait: vi.fn() }}>
        <ContextProbe onClient={onClient} />
      </ReactNativeSSEProvider>
    );

    await waitFor(() => {
      expect(onClient).toHaveBeenCalledWith(client);
    });
  });

  it("registers the client with React Native devtools when a registration context is present", async () => {
    const client = createClient();
    vi.mocked(createSSEClient).mockReturnValue(client);
    const register = vi.fn(() => () => undefined);

    render(
      <ReactNativeSSEDevtoolsRegistrationContext.Provider value={{ register }}>
        <HookProbe options={createOptions()} />
      </ReactNativeSSEDevtoolsRegistrationContext.Provider>
    );

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        id: '["chat"]',
        url: "/stream",
        client
      });
    });
  });
});

function HookProbe({
  options = createOptions(),
  dependencies
}: {
  readonly options?: ReturnType<typeof createOptions>;
  readonly dependencies?: Parameters<typeof useReactNativeSSE>[1];
}) {
  useReactNativeSSE(options, dependencies);

  return null;
}

function ContextProbe({ onClient }: { readonly onClient: (client: SSEClient) => void }) {
  onClient(useReactNativeSSEContext());

  return null;
}

function createOptions() {
  return {
    key: ["chat"],
    url: "/stream",
    enabled: false
  };
}

function createClient(): SSEClient {
  const status: SSEConnectionStatus = "closed";

  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    reconnect: vi.fn(async () => undefined),
    ensureOpen: vi.fn(async () => true),
    getError: vi.fn(() => null),
    getStatus: vi.fn(() => status),
    getLastEventAt: vi.fn(() => undefined),
    subscribeError: vi.fn(() => () => undefined),
    subscribeStatus: vi.fn(() => () => undefined),
    subscribeEvent: vi.fn(() => () => undefined),
    subscribeAnyEvent: vi.fn(() => () => undefined)
  };
}
