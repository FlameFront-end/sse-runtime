import { serializeSSEKey } from "../keys/serialize-sse-key";

export function createChannelName(key: readonly string[]): string {
  return `sse-runtime:${serializeSSEKey(key)}`;
}
