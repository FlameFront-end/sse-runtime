import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { RegistrySnapshot } from "../registry/types";
import { C, GLOBAL_STYLES } from "../theme/tokens";
import { isEditableTarget } from "../lib/shortcut";
import { loadSettings, patchSettings, type ThemePreference } from "../lib/persistence";
import { ConnectionList } from "./connection-list";
import { DetailPane, EmptyDetail } from "./detail-pane";
import { PanelHeader } from "./panel-header";
import { ToggleButton } from "./toggle-button";

const MIN_HEIGHT = 160;
const MAX_HEIGHT_RATIO = 0.92;
const PANEL_INSET = 16;
const COMPACT_WIDTH = 720;

type ResolvedTheme = "light" | "dark";

export type SSEDevtoolsPanelProps = {
  readonly clients: RegistrySnapshot;
  readonly clearEvents: (id: string) => void;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly buttonPosition: "bottom-left" | "bottom-right";
  readonly panelHeight: number;
  readonly hideToggleButton: boolean;
  readonly silentTimeoutMs: number;
  readonly zIndex: number;
};

export function SSEDevtoolsPanel({
  clients,
  clearEvents,
  isOpen,
  onToggle,
  buttonPosition,
  panelHeight,
  hideToggleButton,
  silentTimeoutMs,
  zIndex
}: SSEDevtoolsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [height, setHeight] = useState(() => loadSettings().height ?? panelHeight);
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    () => loadSettings().theme ?? "system"
  );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);
  const [isCompact, setIsCompact] = useState(readIsCompact);
  const dragging = useRef(false);
  const heightRef = useRef(height);
  const panelRef = useRef<HTMLDivElement>(null);
  const theme = themePreference === "system" ? systemTheme : themePreference;

  useEffect(() => {
    if (clients.size === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !clients.has(selectedId)) {
      setSelectedId(clients.keys().next().value ?? null);
    }
  }, [clients, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onResize = () => {
      setIsCompact(readIsCompact());
      setHeight((currentHeight) => {
        const clamped = clampHeight(currentHeight);
        heightRef.current = clamped;
        return clamped;
      });
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isEditableTarget(e.target)) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);

  const onResizeStart = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return;
      const next = clampHeight(getViewportHeight() - ev.clientY);
      heightRef.current = next;
      setHeight(next);
    };

    const onUp = () => {
      dragging.current = false;
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      patchSettings({ height: heightRef.current });
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }, []);

  const onResizeKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    let delta = 0;
    if (e.key === "ArrowUp") delta = step;
    else if (e.key === "ArrowDown") delta = -step;
    else return;
    e.preventDefault();
    const next = clampHeight(heightRef.current + delta);
    heightRef.current = next;
    setHeight(next);
    patchSettings({ height: next });
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemePreference(next);
    patchSettings({ theme: next });
  }, []);

  const selectedRecord = selectedId != null ? (clients.get(selectedId) ?? null) : null;
  const clearSelectedEvents = useCallback(() => {
    if (!selectedRecord) return;
    clearEvents(selectedRecord.id);
  }, [clearEvents, selectedRecord]);

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      {!isOpen && !hideToggleButton && (
        <ToggleButton
          clients={clients}
          position={buttonPosition}
          theme={theme}
          zIndex={zIndex}
          onClick={onToggle}
        />
      )}

      {isOpen && (
        <div
          ref={panelRef}
          className="sse-dt"
          data-theme={theme}
          role="dialog"
          aria-modal={false}
          aria-label="SSE DevTools"
          tabIndex={-1}
          style={{
            position: "fixed",
            bottom: isCompact ? 8 : PANEL_INSET,
            left: isCompact ? 8 : PANEL_INSET,
            right: isCompact ? 8 : PANEL_INSET,
            height: clampHeight(height),
            zIndex,
            display: "flex",
            flexDirection: "column",
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: "hidden",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: 12,
            color: C.text,
            boxShadow: C.shadow
          }}
        >
          <div
            className="sse-dt-resize-handle"
            onPointerDown={onResizeStart}
            onKeyDown={onResizeKeyDown}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize panel"
            aria-valuenow={Math.round(clampHeight(height))}
            aria-valuemin={MIN_HEIGHT}
            aria-valuemax={Math.round(getViewportHeight() * MAX_HEIGHT_RATIO)}
            tabIndex={0}
            title="Drag to resize (or focus and use arrow keys)"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 14,
              cursor: "ns-resize",
              zIndex: 2,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              touchAction: "none"
            }}
          >
            <span
              aria-hidden
              style={{
                marginTop: 4,
                width: 36,
                height: 4,
                borderRadius: 999,
                background: C.border
              }}
            />
          </div>

          <PanelHeader connectionCount={clients.size} isCompact={isCompact} onClose={onToggle} />

          <div
            className="sse-dt-shell"
            style={{
              display: "flex",
              flex: 1,
              flexDirection: isCompact ? "column" : "row",
              minHeight: 0,
              overflow: "hidden"
            }}
          >
            <ConnectionList
              clients={clients}
              selectedId={selectedId}
              isCompact={isCompact}
              themePreference={themePreference}
              onSelect={setSelectedId}
              onSetTheme={setTheme}
            />

            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              {selectedRecord ? (
                <DetailPane
                  key={selectedRecord.id}
                  isCompact={isCompact}
                  record={selectedRecord}
                  silentTimeoutMs={silentTimeoutMs}
                  onClear={clearSelectedEvents}
                />
              ) : (
                <EmptyDetail />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readIsCompact(): boolean {
  if (typeof window === "undefined") return false;
  return (window.visualViewport?.width ?? window.innerWidth) <= COMPACT_WIDTH;
}

function clampHeight(height: number): number {
  if (typeof window === "undefined") return height;
  return Math.max(MIN_HEIGHT, Math.min(height, getViewportHeight() * MAX_HEIGHT_RATIO));
}

function getViewportHeight(): number {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}
