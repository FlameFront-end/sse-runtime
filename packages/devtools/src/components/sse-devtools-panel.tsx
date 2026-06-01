import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { RegistrySnapshot } from "../registry/types";
import { C, GLOBAL_STYLES } from "../theme/tokens";
import { ConnectionList } from "./connection-list";
import { DetailPane, EmptyDetail } from "./detail-pane";
import { PanelHeader } from "./panel-header";
import { ToggleButton } from "./toggle-button";

const MIN_HEIGHT = 160;
const MAX_HEIGHT_RATIO = 0.92;
const PANEL_INSET = 16;
const COMPACT_WIDTH = 720;
const THEME_STORAGE_KEY = "sse-devtools-theme";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

export type SSEDevtoolsPanelProps = {
  readonly clients: RegistrySnapshot;
  readonly clearEvents: (id: string) => void;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly buttonPosition: "bottom-left" | "bottom-right";
  readonly panelHeight: number;
  readonly hideToggleButton: boolean;
};

export function SSEDevtoolsPanel({
  clients,
  clearEvents,
  isOpen,
  onToggle,
  buttonPosition,
  panelHeight,
  hideToggleButton
}: SSEDevtoolsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [height, setHeight] = useState(panelHeight);
  const [themePreference, setThemePreference] = useState<ThemePreference>(readThemePreference);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);
  const [isCompact, setIsCompact] = useState(readIsCompact);
  const dragging = useRef(false);
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
      setHeight((currentHeight) => clampHeight(currentHeight));
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, []);

  const onResizeStart = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return;
      setHeight(clampHeight(getViewportHeight() - ev.clientY));
    };

    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, []);

  const setTheme = useCallback((nextTheme: ResolvedTheme) => {
    setThemePreference(nextTheme);
    writeThemePreference(nextTheme);
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
          connectionCount={clients.size}
          position={buttonPosition}
          theme={theme}
          onClick={onToggle}
        />
      )}

      {isOpen && (
        <div
          className="sse-dt"
          data-theme={theme}
          style={{
            position: "fixed",
            bottom: isCompact ? 8 : PANEL_INSET,
            left: isCompact ? 8 : PANEL_INSET,
            right: isCompact ? 8 : PANEL_INSET,
            height: clampHeight(height),
            zIndex: 99999,
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
            onPointerDown={onResizeStart}
            style={{
              position: "absolute",
              top: 0,
              left: 16,
              right: 16,
              height: 6,
              cursor: "ns-resize",
              zIndex: 1,
              borderTop: "2px solid transparent",
              touchAction: "none"
            }}
          />

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
              theme={theme}
              onSelect={setSelectedId}
              onSetTheme={setTheme}
            />

            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              {selectedRecord ? (
                <DetailPane
                  key={selectedRecord.id}
                  isCompact={isCompact}
                  record={selectedRecord}
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

function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(storedTheme) ? storedTheme : "system";
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

function writeThemePreference(theme: Exclude<ThemePreference, "system">): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}
