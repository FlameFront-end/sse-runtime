import { describe, expect, it, vi } from "vitest";

import { dispatchSSEEvent, parseEventPayloadStrict } from "./dispatch-sse-event";

type Events = {
  readonly message: {
    readonly text: string;
  };
};

describe("dispatchSSEEvent", () => {
  it("dispatches JSON payloads to typed handlers", async () => {
    const handleMessage = vi.fn();

    const result = await dispatchSSEEvent<Events>({
      event: {
        event: "message",
        data: '{"text":"hello"}'
      },
      events: {
        message: handleMessage
      }
    });

    expect(result).toBeNull();
    expect(handleMessage).toHaveBeenCalledWith({ text: "hello" });
  });

  it("returns a transport error and skips the handler when payload is invalid JSON", async () => {
    const handleMessage = vi.fn();

    const result = await dispatchSSEEvent<Events>({
      event: {
        event: "message",
        data: "{corrupted json"
      },
      events: {
        message: handleMessage
      }
    });

    expect(result).toMatchObject({
      kind: "transport",
      message: expect.stringContaining('"message"')
    });
    expect(handleMessage).not.toHaveBeenCalled();
  });

  it("returns handler errors without throwing", async () => {
    const handlerError = new Error("handler failed");

    const result = await dispatchSSEEvent<Events>({
      event: {
        event: "message",
        data: '{"text":"hello"}'
      },
      events: {
        message: () => {
          throw handlerError;
        }
      }
    });

    expect(result).toEqual({
      kind: "handler",
      message: "handler failed",
      cause: handlerError
    });
  });
});

describe("parseEventPayloadStrict", () => {
  it("parses valid JSON successfully", () => {
    const result = parseEventPayloadStrict('{"text":"hello"}', "message");
    expect(result).toEqual({ ok: true, value: { text: "hello" } });
  });

  it("returns error for JSON-like but malformed payload", () => {
    const result = parseEventPayloadStrict("{corrupted json", "message");
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "transport", message: expect.stringContaining('"message"') }
    });
  });

  it("returns error for malformed JSON array", () => {
    const result = parseEventPayloadStrict("[1, 2,", "update");
    expect(result).toMatchObject({ ok: false, error: { kind: "transport" } });
  });

  it("passes plain-text payload through as-is", () => {
    expect(parseEventPayloadStrict("привет", "ping")).toEqual({ ok: true, value: "привет" });
    expect(parseEventPayloadStrict("ok", "status")).toEqual({ ok: true, value: "ok" });
  });
});
