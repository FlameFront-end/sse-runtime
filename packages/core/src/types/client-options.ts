import type { AuthOptions } from "./auth";
import type { CoordinationOptions } from "./coordination";
import type { DiagnosticsOptions } from "./diagnostics";
import type { EventHandler, EventMap } from "./events";
import type { HeartbeatOptions } from "./heartbeat";
import type { ReconnectOptions } from "./reconnect";
import type { RetryPolicyOptions } from "./retry";

export type SSEClientOptions<Events extends EventMap> = {
  readonly key: readonly string[];
  readonly url: string;
  readonly enabled?: boolean;
  readonly headers?:
    | Record<string, string>
    | (() => Promise<Record<string, string>> | Record<string, string>);
  readonly credentials?: RequestCredentials;
  readonly events?: Partial<{
    readonly [EventName in keyof Events]: EventHandler<Events[EventName]>;
  }>;
  readonly reconnect?: ReconnectOptions;
  readonly auth?: AuthOptions;
  readonly coordination?: CoordinationOptions;
  readonly heartbeat?: HeartbeatOptions;
  readonly diagnostics?: DiagnosticsOptions;
  readonly retry?: RetryPolicyOptions;
  readonly openTimeout?: number;
};
