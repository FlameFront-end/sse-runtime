import {
  createSSEClient,
  serializeSSEKey,
  type CoordinationRole,
  type EventMap,
  type SSEClient,
  type SSEClientDependencies,
  type SSEClientOptions
} from "@flamefrontend/sse-runtime-core";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { ReactNativeSSEDevtoolsRegistrationContext } from "../devtools/devtools-registration-context";
import { createReactNativeClientOptions } from "./create-react-native-client-options";
import { useLatestRef } from "./use-latest-ref";
import type { UseReactNativeSSEResult } from "../types/public";

const ReactNativeSSEContext = createContext<SSEClient | null>(null);
const DEFAULT_DEPENDENCIES: SSEClientDependencies = {};

export type ReactNativeSSEProviderProps<Events extends EventMap> = {
  readonly options: SSEClientOptions<Events>;
  readonly dependencies?: SSEClientDependencies;
  readonly children: ReactNode;
};

export function useReactNativeSSE<Events extends EventMap>(
  options: SSEClientOptions<Events>,
  dependencies: SSEClientDependencies = DEFAULT_DEPENDENCIES
): UseReactNativeSSEResult<Events> {
  const optionsRef = useLatestRef(options);
  const keySignature = useMemo(() => serializeSSEKey(options.key), [options.key]);
  const eventNamesSignature = useMemo(
    () =>
      Object.keys(options.events ?? {})
        .sort()
        .join("\u0000"),
    [options.events]
  );
  const coordinationSignature = useMemo(
    () => JSON.stringify(options.coordination ?? null),
    [options.coordination]
  );

  const clientOptions = useMemo(
    () => createReactNativeClientOptions(options, optionsRef),
    [
      keySignature,
      options.url,
      options.enabled,
      options.credentials,
      eventNamesSignature,
      coordinationSignature,
      options.heartbeat,
      options.openTimeout
    ]
  );
  const client = useMemo(
    () => createSSEClient(clientOptions, dependencies),
    [clientOptions, dependencies]
  );
  const [status, setStatus] = useState(client.getStatus);
  const [error, setError] = useState(client.getError);
  const [role, setRole] = useState<CoordinationRole | null>(() => client.getRole?.() ?? null);

  useEffect(() => client.subscribeStatus(setStatus), [client]);
  useEffect(() => client.subscribeError(setError), [client]);
  useEffect(() => {
    setRole(client.getRole?.() ?? null);
    return client.subscribeRole?.(setRole);
  }, [client]);

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }

    void client.connect();

    return () => {
      client.disconnect();
    };
  }, [client, options.enabled]);

  const devtools = useContext(ReactNativeSSEDevtoolsRegistrationContext);

  useEffect(() => {
    if (!devtools) return;
    return devtools.register({
      id: keySignature,
      url: options.url,
      client
    });
  }, [devtools, client, keySignature, options.url]);

  const connect = useCallback(() => client.connect(), [client]);
  const disconnect = useCallback(() => client.disconnect(), [client]);
  const reconnect = useCallback(() => client.reconnect(), [client]);
  const ensureOpen = useCallback(
    (ensureOptions?: { readonly timeout?: number }) => client.ensureOpen(ensureOptions),
    [client]
  );

  return {
    status,
    error,
    role,
    connect,
    disconnect,
    reconnect,
    ensureOpen,
    client
  };
}

export function ReactNativeSSEProvider<Events extends EventMap>({
  options,
  dependencies = DEFAULT_DEPENDENCIES,
  children
}: ReactNativeSSEProviderProps<Events>): ReactNode {
  const { client } = useReactNativeSSE(options, dependencies);

  return <ReactNativeSSEContext.Provider value={client}>{children}</ReactNativeSSEContext.Provider>;
}

export function useReactNativeSSEContext<Events extends EventMap = EventMap>(): SSEClient<Events> {
  const client = useContext(ReactNativeSSEContext);

  if (!client) {
    throw new Error("useReactNativeSSEContext must be used within ReactNativeSSEProvider");
  }

  return client as SSEClient<Events>;
}
