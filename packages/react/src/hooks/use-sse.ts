import {
  createSSEClient,
  serializeSSEKey,
  type EventMap,
  type SSEClientOptions
} from "@flamefrontend/sse-runtime-core";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import { SSEDevtoolsRegistrationContext } from "../devtools/devtools-registration-context";

import { createReactClientOptions } from "./create-react-client-options";
import { useLatestRef } from "./use-latest-ref";
import type { UseSSEResult } from "../types/public";

export function useSSE<Events extends EventMap>(
  options: SSEClientOptions<Events>
): UseSSEResult<Events> {
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
    () => createReactClientOptions(options, optionsRef),
    [
      keySignature,
      options.url,
      options.enabled,
      options.credentials,
      eventNamesSignature,
      coordinationSignature
    ]
  );
  const client = useMemo(() => createSSEClient(clientOptions), [clientOptions]);
  const [status, setStatus] = useState(client.getStatus);
  const [error, setError] = useState(client.getError);

  useEffect(
    () =>
      client.subscribeStatus((nextStatus) => {
        setStatus(nextStatus);
      }),
    [client]
  );

  useEffect(() => client.subscribeError(setError), [client]);

  useEffect(() => {
    if (options.enabled === false) {
      return;
    }

    void client.connect();

    return () => {
      client.disconnect();
    };
  }, [client, options.enabled]);

  const devtools = useContext(SSEDevtoolsRegistrationContext);

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
    connect,
    disconnect,
    reconnect,
    ensureOpen,
    client
  };
}
