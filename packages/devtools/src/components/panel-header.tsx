import { C, S } from "../theme/tokens";

type PanelHeaderProps = {
  readonly connectionCount: number;
  readonly isCompact: boolean;
  readonly onClose: () => void;
};

export function PanelHeader({ connectionCount, isCompact, onClose }: PanelHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isCompact ? "0 10px 0 14px" : "0 12px 0 16px",
        height: isCompact ? 34 : 46,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: isCompact ? 12 : 13 }}>SSE DevTools</span>
        <span
          style={{
            color: C.textMuted,
            fontSize: isCompact ? 10 : 11,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 999,
            padding: isCompact ? "2px 7px" : "3px 8px",
            ...S.mono
          }}
        >
          {connectionCount} {connectionCount === 1 ? "connection" : "connections"}
        </span>
      </div>
      <button
        className="sse-dt-soft-button"
        onClick={onClose}
        title="Close DevTools (Esc)"
        aria-label="Close DevTools"
        style={{
          background: "transparent",
          border: "none",
          borderRadius: 6,
          color: C.textMuted,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          height: isCompact ? 24 : 28,
          lineHeight: 1,
          padding: 0,
          width: isCompact ? 24 : 28
        }}
      >
        ×
      </button>
    </div>
  );
}
