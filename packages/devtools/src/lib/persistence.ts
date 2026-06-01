export type ThemePreference = "system" | "light" | "dark";
export type TogglePosition = { readonly x: number; readonly y: number };

export type DevtoolsSettings = {
  readonly theme: ThemePreference;
  readonly height: number;
  readonly open: boolean;
  readonly togglePos: TogglePosition | null;
};

const STORAGE_KEY = "sse-devtools:settings:v1";
const LEGACY_THEME_KEY = "sse-devtools-theme";

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isTogglePosition(value: unknown): value is TogglePosition {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TogglePosition).x === "number" &&
    typeof (value as TogglePosition).y === "number"
  );
}

export function loadSettings(): Partial<DevtoolsSettings> {
  if (!hasStorage()) return {};

  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const out: { -readonly [K in keyof DevtoolsSettings]?: DevtoolsSettings[K] } = {};
  const record = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Record<
    string,
    unknown
  >;

  if (isThemePreference(record.theme)) out.theme = record.theme;
  if (typeof record.height === "number" && Number.isFinite(record.height)) {
    out.height = record.height;
  }
  if (typeof record.open === "boolean") out.open = record.open;
  if (record.togglePos === null || isTogglePosition(record.togglePos)) {
    out.togglePos = record.togglePos;
  }

  if (out.theme === undefined) {
    const legacy = safeGet(LEGACY_THEME_KEY);
    if (isThemePreference(legacy)) out.theme = legacy;
  }

  return out;
}

export function patchSettings(patch: Partial<DevtoolsSettings>): void {
  if (!hasStorage()) return;
  try {
    const current = loadSettings();
    const next = { ...current, ...patch };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
