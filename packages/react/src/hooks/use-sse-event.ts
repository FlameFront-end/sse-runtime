import { useEffect } from "react";
import type { EventHandler, EventMap, SSEClient } from "@flamefrontend/sse-runtime-core";

import { useLatestRef } from "./use-latest-ref";

export function useSSEEvent<Events extends EventMap, EventName extends keyof Events>(
  connection: SSEClient<Events>,
  eventName: EventName,
  handler: EventHandler<Events[EventName]>
): void {
  const handlerRef = useLatestRef(handler);

  useEffect(() => {
    return connection.subscribeEvent(eventName, (payload) => handlerRef.current(payload));
  }, [connection, eventName]);
}
