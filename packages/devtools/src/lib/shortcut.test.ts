import { describe, expect, it } from "vitest";
import { matchesShortcut, parseShortcut } from "./shortcut";

function keyEvent(init: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    code: "",
    key: "",
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    ...init
  } as KeyboardEvent;
}

describe("parseShortcut", () => {
  it("returns null for blank input", () => {
    expect(parseShortcut("")).toBeNull();
    expect(parseShortcut("   ")).toBeNull();
  });

  it("maps a letter key to a KeyboardEvent.code", () => {
    expect(parseShortcut("alt+d")).toEqual({
      code: "KeyD",
      key: null,
      alt: true,
      ctrl: false,
      shift: false,
      meta: false
    });
  });

  it("maps a digit key to a Digit code", () => {
    expect(parseShortcut("ctrl+1")?.code).toBe("Digit1");
  });

  it("falls back to key for named keys", () => {
    const parsed = parseShortcut("escape");
    expect(parsed?.code).toBeNull();
    expect(parsed?.key).toBe("escape");
  });
});

describe("matchesShortcut", () => {
  it("matches via code regardless of the mutated key value (macOS Alt)", () => {
    const parsed = parseShortcut("alt+d")!;
    expect(matchesShortcut(parsed, keyEvent({ code: "KeyD", key: "∂", altKey: true }))).toBe(true);
  });

  it("requires the exact modifier set", () => {
    const parsed = parseShortcut("alt+d")!;
    expect(
      matchesShortcut(parsed, keyEvent({ code: "KeyD", key: "d", altKey: true, shiftKey: true }))
    ).toBe(false);
  });

  it("matches named keys via key", () => {
    const parsed = parseShortcut("escape")!;
    expect(matchesShortcut(parsed, keyEvent({ key: "Escape" }))).toBe(true);
  });
});
