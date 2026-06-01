import { useContext } from "react";
import type { EventMap, SSEClient } from "@flamefrontend/sse-runtime-core";

import { SSEContext } from "../context/sse-context";

export function useSSEContext<Events extends EventMap>(): SSEClient<Events> {
  const client = useContext(SSEContext);

  if (!client) {
    throw new Error("useSSEContext must be called inside an SSEProvider");
  }

  return client as SSEClient<Events>;
}
