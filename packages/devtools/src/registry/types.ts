import type {
  CoordinationRole,
  SSEConnectionStatus,
  SSEError
} from "@flamefrontend/sse-runtime-core";
import type { SSEDevtoolsClientInfo } from "@flamefrontend/sse-runtime-react";

export type DevtoolsEventEntry = {
  readonly id: string;
  readonly type: string;
  readonly data: unknown;
  readonly timestamp: number;
};

export type DevtoolsClientRecord = {
  readonly id: string;
  readonly key: string;
  readonly url: string;
  readonly status: SSEConnectionStatus;
  readonly role: CoordinationRole | null;
  readonly error: SSEError | null;
  readonly events: readonly DevtoolsEventEntry[];
  readonly recentEventTimestamps: readonly number[];
  readonly totalEvents: number;
  readonly connectedAt: number | null;
  readonly firstConnectedAt: number | null;
  readonly reconnectCount: number;
  readonly lastEventAt: number | null;
  readonly client: SSEDevtoolsClientInfo["client"];
};

export type RegistrySnapshot = ReadonlyMap<string, DevtoolsClientRecord>;
