import { C, S } from "../theme/tokens";

type ToggleButtonProps = {
  readonly connectionCount: number;
  readonly position: "bottom-left" | "bottom-right";
  readonly theme: "light" | "dark";
  readonly onClick: () => void;
};

export function ToggleButton({ connectionCount, position, theme, onClick }: ToggleButtonProps) {
  const side = position === "bottom-right" ? { right: 16 } : { left: 16 };
  return (
    <button
      className="sse-dt-toggle"
      data-theme={theme}
      onClick={onClick}
      title="Open SSE DevTools"
      style={{
        position: "fixed",
        bottom: 16,
        ...side,
        zIndex: 99998,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 999,
        color: C.text,
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 600,
        minHeight: 34,
        padding: "0 12px",
        boxShadow: "0 12px 30px rgba(0, 0, 0, 0.12)",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: connectionCount > 0 ? C.open : C.closed,
          boxShadow: `0 0 0 3px ${connectionCount > 0 ? "#16a34a1f" : "#7373731f"}`
        }}
      />
      <span style={{ ...S.mono }}>SSE</span>
      {connectionCount > 0 && (
        <span
          style={{
            background: C.accent,
            borderRadius: 10,
            color: C.bg,
            fontSize: 10,
            fontWeight: 700,
            minWidth: 16,
            padding: "1px 5px",
            textAlign: "center"
          }}
        >
          {connectionCount}
        </span>
      )}
    </button>
  );
}
