import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { SSEConnectionStatus } from "@flamefrontend/sse-runtime-core";
import type { RegistrySnapshot } from "../registry/types";
import { C, S, statusColor } from "../theme/tokens";
import { loadSettings, patchSettings, type TogglePosition } from "../lib/persistence";

type ToggleButtonProps = {
  readonly clients: RegistrySnapshot;
  readonly position: "bottom-left" | "bottom-right";
  readonly theme: "light" | "dark";
  readonly zIndex: number;
  readonly onClick: () => void;
};

const DRAG_THRESHOLD = 5;
const EDGE_MARGIN = 8;

const STATUS_PRIORITY: Record<SSEConnectionStatus, number> = {
  error: 5,
  reconnecting: 4,
  connecting: 3,
  open: 2,
  closed: 1,
  idle: 0
};

function aggregateStatus(clients: RegistrySnapshot): SSEConnectionStatus | null {
  let worst: SSEConnectionStatus | null = null;
  for (const record of clients.values()) {
    if (worst === null || STATUS_PRIORITY[record.status] > STATUS_PRIORITY[worst]) {
      worst = record.status;
    }
  }
  return worst;
}

export function ToggleButton({ clients, position, theme, zIndex, onClick }: ToggleButtonProps) {
  const connectionCount = clients.size;
  const status = aggregateStatus(clients);
  const dotColor = status ? statusColor(status) : C.closed;
  const isAttention = status === "error" || status === "reconnecting";

  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<TogglePosition | null>(() => loadSettings().togglePos ?? null);
  const drag = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    if (!pos || typeof window === "undefined" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const clamped = clampToViewport(pos, rect.width, rect.height);
    if (clamped.x !== pos.x || clamped.y !== pos.y) setPos(clamped);
  }, [pos]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    drag.current = { startX: e.clientX, startY: e.clientY, moved: false };
    el.setPointerCapture(e.pointerId);

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const onMove = (ev: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      if (
        !state.moved &&
        Math.abs(ev.clientX - state.startX) + Math.abs(ev.clientY - state.startY) > DRAG_THRESHOLD
      ) {
        state.moved = true;
      }
      if (!state.moved) return;
      const next = clampToViewport(
        { x: ev.clientX - offsetX, y: ev.clientY - offsetY },
        rect.width,
        rect.height
      );
      setPos(next);
    };

    const onUp = () => {
      const state = drag.current;
      drag.current = null;
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (state?.moved) {
        suppressClick.current = true;
        const rectNow = el.getBoundingClientRect();
        patchSettings({ togglePos: { x: rectNow.left, y: rectNow.top } });
      }
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }, []);

  const handleClick = useCallback(() => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    onClick();
  }, [onClick]);

  const placement: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : position === "bottom-right"
      ? { right: 16, bottom: 16 }
      : { left: 16, bottom: 16 };

  return (
    <button
      ref={ref}
      className="sse-dt-toggle"
      data-theme={theme}
      onPointerDown={onPointerDown}
      onClick={handleClick}
      title="Open SSE DevTools (drag to move)"
      aria-label="Open SSE DevTools"
      style={{
        position: "fixed",
        ...placement,
        zIndex,
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
        touchAction: "none",
        boxShadow: "0 12px 30px rgba(0, 0, 0, 0.12)",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dotColor,
          boxShadow: `0 0 0 3px ${dotColor}1f`,
          animation: isAttention ? "sse-dt-pulse 1.4s ease-in-out infinite" : undefined
        }}
      />
      <span style={{ ...S.mono }}>SSE</span>
      {connectionCount > 0 && (
        <span
          style={{
            background: isAttention ? dotColor : C.accent,
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

function clampToViewport(pos: TogglePosition, width: number, height: number): TogglePosition {
  if (typeof window === "undefined") return pos;
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN);
  return {
    x: Math.min(Math.max(EDGE_MARGIN, pos.x), maxX),
    y: Math.min(Math.max(EDGE_MARGIN, pos.y), maxY)
  };
}
