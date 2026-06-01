import { createCoordinatedSSEClient } from "../coordination/create-coordinated-sse-client";
import { createDefaultCoordinationBackend } from "../coordination/coordination-backend";
import type { EventMap, SSEClientOptions } from "../types/public";
import { createLocalSSEClient } from "./create-local-sse-client";
import type { SSEClient, SSEClientDependencies } from "./create-local-sse-client";

export type { SSEClient, SSEClientDependencies } from "./create-local-sse-client";

export function createSSEClient<Events extends EventMap>(
  options: SSEClientOptions<Events>,
  dependencies: SSEClientDependencies = {}
): SSEClient<Events> {
  const coordinationEnabled =
    options.coordination?.enabled === true &&
    (options.coordination.mode ?? "single-tab") === "single-tab";

  if (!coordinationEnabled) {
    return createLocalSSEClient(options, dependencies);
  }

  const backend = dependencies.coordinationBackend ?? createDefaultCoordinationBackend();

  if (!backend) {
    // No coordination primitives available (e.g. no BroadcastChannel / Web Locks).
    // Degrade gracefully to an independent per-tab connection.
    return createLocalSSEClient(options, dependencies);
  }

  return createCoordinatedSSEClient(options, dependencies, backend);
}
