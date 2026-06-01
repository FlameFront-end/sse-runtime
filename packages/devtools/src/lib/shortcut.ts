export type ParsedShortcut = {
  readonly code: string | null;
  readonly key: string | null;
  readonly alt: boolean;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
};

export function parseShortcut(shortcut: string): ParsedShortcut | null {
  const trimmed = shortcut.trim().toLowerCase();
  if (!trimmed) return null;

  const parts = trimmed.split("+").filter(Boolean);
  if (parts.length === 0) return null;

  const last = parts[parts.length - 1];
  let code: string | null = null;
  let key: string | null = null;

  if (/^[a-z]$/.test(last)) {
    code = `Key${last.toUpperCase()}`;
  } else if (/^[0-9]$/.test(last)) {
    code = `Digit${last}`;
  } else {
    key = last;
  }

  return {
    code,
    key,
    alt: parts.includes("alt"),
    ctrl: parts.includes("ctrl"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta")
  };
}

export function matchesShortcut(parsed: ParsedShortcut, event: KeyboardEvent): boolean {
  const keyMatches = parsed.code
    ? event.code === parsed.code
    : event.key.toLowerCase() === parsed.key;
  return (
    keyMatches &&
    event.altKey === parsed.alt &&
    event.ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.metaKey === parsed.meta
  );
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
