import { createTransportError, normalizeError } from "../errors/sse-error";
import type { ParsedSSEEvent } from "../parser/parse-sse-chunk";
import type { EventMap, SSEClientOptions, SSEError } from "../types/public";

export type DispatchSSEEventOptions<Events extends EventMap> = {
  readonly event: ParsedSSEEvent;
  readonly events: SSEClientOptions<Events>["events"];
};

export async function dispatchSSEEvent<Events extends EventMap>(
  options: DispatchSSEEventOptions<Events>
): Promise<SSEError | null> {
  const handler = options.events?.[options.event.event as keyof Events];

  if (!handler) {
    return null;
  }

  const parsed = parseEventPayloadStrict(options.event.data, options.event.event);

  if (!parsed.ok) {
    return parsed.error;
  }

  try {
    await handler(parsed.value as Events[keyof Events]);
    return null;
  } catch (cause) {
    return normalizeError(cause, "handler");
  }
}

export type StrictPayloadResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: SSEError };

export function parseEventPayloadStrict(data: string, eventName: string): StrictPayloadResult {
  try {
    return { ok: true, value: JSON.parse(data) };
  } catch {
    if (looksLikeJSON(data)) {
      return {
        ok: false,
        error: createTransportError(`Received invalid JSON payload for "${eventName}" event`)
      };
    }
    return { ok: true, value: data };
  }
}

export function parseEventPayload(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return payload;
  }
}

function looksLikeJSON(s: string): boolean {
  const t = s.trimStart();
  return t.startsWith("{") || t.startsWith("[");
}
