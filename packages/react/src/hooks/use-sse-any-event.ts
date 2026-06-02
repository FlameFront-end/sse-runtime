import { useEffect } from "react";
import type { EventMap, SSEAnyEventHandler, SSEClient } from "@flamefrontend/sse-runtime-core";

import { useLatestRef } from "./use-latest-ref";

export function useSSEAnyEvent<Events extends EventMap>(
  connection: SSEClient<Events>,
  handler: SSEAnyEventHandler
): void {
  const handlerRef = useLatestRef(handler);

  useEffect(() => {
    return connection.subscribeAnyEvent((event) => handlerRef.current(event));
  }, [connection]);
}
