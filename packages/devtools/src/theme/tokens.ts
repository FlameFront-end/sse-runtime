import type { SSEConnectionStatus } from "@flamefrontend/sse-runtime-core";

export const C = {
  bg: "var(--sse-dt-bg)",
  surface: "var(--sse-dt-surface)",
  surfaceRaised: "var(--sse-dt-surface-raised)",
  border: "var(--sse-dt-border)",
  borderLight: "var(--sse-dt-border-light)",
  text: "var(--sse-dt-text)",
  textMuted: "var(--sse-dt-text-muted)",
  textDim: "var(--sse-dt-text-dim)",
  open: "#16a34a",
  connecting: "#f59e0b",
  reconnecting: "#ca8a04",
  error: "#dc2626",
  closed: "#737373",
  accent: "var(--sse-dt-accent)",
  accentBg: "var(--sse-dt-accent-bg)",
  selectedBg: "var(--sse-dt-selected-bg)",
  errorBg: "var(--sse-dt-error-bg)",
  btnBg: "var(--sse-dt-btn-bg)",
  btnBorder: "var(--sse-dt-btn-border)",
  btnHover: "var(--sse-dt-btn-hover)",
  shadow: "var(--sse-dt-shadow)"
} as const;

export function statusColor(s: SSEConnectionStatus): string {
  switch (s) {
    case "open":
      return C.open;
    case "connecting":
      return C.connecting;
    case "reconnecting":
      return C.reconnecting;
    case "error":
      return C.error;
    default:
      return C.closed;
  }
}

export function statusLabel(s: SSEConnectionStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const GLOBAL_STYLES = `
  .sse-dt,
  .sse-dt-toggle {
    --sse-dt-bg: #ffffff;
    --sse-dt-surface: #fafafa;
    --sse-dt-surface-raised: #ffffff;
    --sse-dt-border: #e5e5e5;
    --sse-dt-border-light: #f2f2f2;
    --sse-dt-text: #171717;
    --sse-dt-text-muted: #666666;
    --sse-dt-text-dim: #a3a3a3;
    --sse-dt-accent: #000000;
    --sse-dt-accent-bg: #f5f5f5;
    --sse-dt-selected-bg: #f5f5f5;
    --sse-dt-error-bg: #fef2f2;
    --sse-dt-btn-bg: #ffffff;
    --sse-dt-btn-border: #d4d4d4;
    --sse-dt-btn-hover: #f5f5f5;
    --sse-dt-shadow: 0 24px 80px rgba(0, 0, 0, 0.16), 0 4px 24px rgba(0, 0, 0, 0.08);
  }
  .sse-dt[data-theme="dark"],
  .sse-dt-toggle[data-theme="dark"] {
    --sse-dt-bg: #000000;
    --sse-dt-surface: #0a0a0a;
    --sse-dt-surface-raised: #111111;
    --sse-dt-border: #262626;
    --sse-dt-border-light: #1f1f1f;
    --sse-dt-text: #fafafa;
    --sse-dt-text-muted: #a3a3a3;
    --sse-dt-text-dim: #737373;
    --sse-dt-accent: #ffffff;
    --sse-dt-accent-bg: #171717;
    --sse-dt-selected-bg: #171717;
    --sse-dt-error-bg: #2a1111;
    --sse-dt-btn-bg: #111111;
    --sse-dt-btn-border: #333333;
    --sse-dt-btn-hover: #1f1f1f;
    --sse-dt-shadow: 0 24px 80px rgba(0, 0, 0, 0.5), 0 4px 24px rgba(0, 0, 0, 0.36);
  }
  @keyframes sse-dt-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  .sse-dt * { box-sizing: border-box; }
  .sse-dt button,
  .sse-dt input {
    font: inherit;
  }
  .sse-dt button,
  .sse-dt-toggle {
    transform: none !important;
    translate: none !important;
  }
  .sse-dt button:hover,
  .sse-dt-toggle:hover {
    transform: none !important;
    translate: none !important;
  }
  .sse-dt .sse-dt-soft-button:hover {
    background: var(--sse-dt-btn-hover) !important;
  }
  .sse-dt button:focus-visible,
  .sse-dt input:focus-visible {
    outline: 2px solid var(--sse-dt-accent);
    outline-offset: 2px;
  }
  .sse-dt ::selection { background: var(--sse-dt-accent); color: var(--sse-dt-bg); }
  .sse-dt ::-webkit-scrollbar { width: 8px; height: 8px; }
  .sse-dt ::-webkit-scrollbar-track { background: transparent; }
  .sse-dt ::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
  .sse-dt ::-webkit-scrollbar-thumb:hover { background: #a3a3a3; background-clip: content-box; }
  .sse-dt { scrollbar-width: thin; scrollbar-color: #d4d4d4 transparent; }
`;

export const S = {
  ellipsis: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  },
  caption: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0
  },
  mono: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  }
} as const;
