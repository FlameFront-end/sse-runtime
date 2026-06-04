import type { SSEConnectionStatus } from "@flamefrontend/sse-runtime-core";

export type DevtoolsTheme = "dark" | "light";

export type DevtoolsPalette = {
  readonly accent: string;
  readonly background: string;
  readonly border: string;
  readonly borderSoft: string;
  readonly button: string;
  readonly card: string;
  readonly danger: string;
  readonly dangerBackground: string;
  readonly muted: string;
  readonly overlay: string;
  readonly selected: string;
  readonly text: string;
  readonly textMuted: string;
  readonly warning: string;
  readonly success: string;
  readonly closed: string;
};

export const PALETTES: Record<DevtoolsTheme, DevtoolsPalette> = {
  dark: {
    accent: "#7dd3fc",
    background: "#09090b",
    border: "#27272a",
    borderSoft: "#18181b",
    button: "#18181b",
    card: "#111113",
    danger: "#f87171",
    dangerBackground: "#2a1111",
    muted: "#71717a",
    overlay: "rgba(0, 0, 0, 0.44)",
    selected: "#172033",
    text: "#f4f4f5",
    textMuted: "#a1a1aa",
    warning: "#facc15",
    success: "#22c55e",
    closed: "#71717a"
  },
  light: {
    accent: "#0369a1",
    background: "#ffffff",
    border: "#d4d4d8",
    borderSoft: "#e4e4e7",
    button: "#f4f4f5",
    card: "#fafafa",
    danger: "#dc2626",
    dangerBackground: "#fef2f2",
    muted: "#a1a1aa",
    overlay: "rgba(24, 24, 27, 0.24)",
    selected: "#e0f2fe",
    text: "#18181b",
    textMuted: "#52525b",
    warning: "#ca8a04",
    success: "#16a34a",
    closed: "#71717a"
  }
};

export function statusColor(status: SSEConnectionStatus, palette: DevtoolsPalette): string {
  switch (status) {
    case "open":
      return palette.success;
    case "connecting":
    case "reconnecting":
      return palette.warning;
    case "error":
      return palette.danger;
    default:
      return palette.closed;
  }
}

export function statusLabel(status: SSEConnectionStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
