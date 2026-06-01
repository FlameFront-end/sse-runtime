import { useState, useEffect } from "react";
import type {
  SSEConnectionStatus,
  SSEError,
  SSEErrorListener,
  SSEStatusListener
} from "@flamefrontend/sse-runtime-core";

import type { UseSSEStatusResult } from "../types/public";

type StatusSource = {
  readonly getStatus: () => SSEConnectionStatus;
  readonly getError: () => SSEError | null;
  readonly subscribeStatus: (listener: SSEStatusListener) => () => void;
  readonly subscribeError: (listener: SSEErrorListener) => () => void;
};

export function useSSEStatus(connection: StatusSource): UseSSEStatusResult {
  const [status, setStatus] = useState(connection.getStatus);
  const [error, setError] = useState(connection.getError);

  useEffect(() => connection.subscribeStatus(setStatus), [connection]);
  useEffect(() => connection.subscribeError(setError), [connection]);

  return { status, error };
}
