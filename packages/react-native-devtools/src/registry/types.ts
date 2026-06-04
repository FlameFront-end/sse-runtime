import type {
  CoordinationRole,
  SSEConnectionStatus,
  SSEError
} from "@flamefrontend/sse-runtime-core";
import type { ReactNativeSSEDevtoolsClientInfo } from "@flamefrontend/sse-runtime-react-native";

export type ReactNativeDevtoolsEventEntry = {
  readonly id: string;
  readonly type: string;
  readonly data: unknown;
  readonly timestamp: number;
};

export type ReactNativeDevtoolsClientRecord = {
  readonly id: string;
  readonly key: string;
  readonly url: string;
  readonly status: SSEConnectionStatus;
  readonly role: CoordinationRole | null;
  readonly error: SSEError | null;
  readonly events: readonly ReactNativeDevtoolsEventEntry[];
  readonly recentEventTimestamps: readonly number[];
  readonly totalEvents: number;
  readonly connectedAt: number | null;
  readonly firstConnectedAt: number | null;
  readonly reconnectCount: number;
  readonly lastEventAt: number | null;
  readonly client: ReactNativeSSEDevtoolsClientInfo["client"];
};

export type ReactNativeDevtoolsSnapshot = ReadonlyMap<string, ReactNativeDevtoolsClientRecord>;
