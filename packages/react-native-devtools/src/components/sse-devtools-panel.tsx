import { memo, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, View, useWindowDimensions } from "react-native";

import type { ReactNativeDevtoolsSnapshot } from "../registry/types";
import type { ReactNativeSSEDevtoolsExportPayload } from "./sse-devtools-provider";
import { PALETTES, type DevtoolsTheme } from "../theme/tokens";
import { ConnectionList } from "./connection-list";
import { DetailPane } from "./detail-pane";
import { EmptyState } from "./empty-state";
import { PanelHeader } from "./panel-header";
import { ToggleButton } from "./toggle-button";

const MIN_PANEL_HEIGHT = 300;
const MAX_PANEL_TOP_INSET = 56;

export type ReactNativeSSEDevtoolsPanelProps = {
  readonly clients: ReactNativeDevtoolsSnapshot;
  readonly clearEvents: (id: string) => void;
  readonly hideToggleButton: boolean;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly onToggleTheme: () => void;
  readonly onCopyPayload?: (payload: string) => void | Promise<void>;
  readonly onExportEvents?: (payload: ReactNativeSSEDevtoolsExportPayload) => void | Promise<void>;
  readonly panelHeight: number;
  readonly theme: DevtoolsTheme;
  readonly toggleButtonPosition: "bottom-left" | "bottom-right" | "top-left" | "top-right";
};

export const ReactNativeSSEDevtoolsPanel = memo(function ReactNativeSSEDevtoolsPanel({
  clients,
  clearEvents,
  hideToggleButton,
  isOpen,
  onCopyPayload,
  onExportEvents,
  onToggle,
  onToggleTheme,
  panelHeight,
  theme,
  toggleButtonPosition
}: ReactNativeSSEDevtoolsPanelProps) {
  const palette = PALETTES[theme];
  const { height: windowHeight } = useWindowDimensions();
  const maxPanelHeight = Math.max(MIN_PANEL_HEIGHT, windowHeight - MAX_PANEL_TOP_INSET);
  const records = useMemo(() => Array.from(clients.values()), [clients]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [height, setHeight] = useState(() =>
    clampPanelHeight(panelHeight, MIN_PANEL_HEIGHT, maxPanelHeight)
  );
  const dragStartHeight = useRef(height);

  useEffect(() => {
    setHeight((current) => clampPanelHeight(current, MIN_PANEL_HEIGHT, maxPanelHeight));
  }, [maxPanelHeight]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          dragStartHeight.current = height;
        },
        onPanResponderMove: (_event, gesture) => {
          setHeight(
            clampPanelHeight(dragStartHeight.current - gesture.dy, MIN_PANEL_HEIGHT, maxPanelHeight)
          );
        }
      }),
    [height, maxPanelHeight]
  );

  useEffect(() => {
    if (records.length === 0) {
      setSelectedId(null);
      setIsDetailVisible(false);
      return;
    }

    if (!selectedId || !clients.has(selectedId)) {
      setSelectedId(records[0].id);
      setIsDetailVisible(records.length === 1);
    }
  }, [clients, records, selectedId]);

  const selectedRecord = selectedId ? (clients.get(selectedId) ?? null) : null;
  const showConnections = !isDetailVisible || !selectedRecord;

  if (!isOpen && !hideToggleButton) {
    return (
      <ToggleButton
        connectionCount={records.length}
        hasError={records.some((record) => record.status === "error")}
        palette={palette}
        position={toggleButtonPosition}
        onPress={onToggle}
      />
    );
  }

  if (!isOpen) {
    return null;
  }

  return (
    <View style={[styles.overlay, { backgroundColor: palette.overlay }]} pointerEvents="box-none">
      <View
        style={[
          styles.panel,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
            height
          }
        ]}
      >
        <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
          <View style={[styles.dragHandle, { backgroundColor: palette.border }]} />
        </View>

        <PanelHeader
          connectionCount={records.length}
          isDetailVisible={!showConnections}
          palette={palette}
          subtitle={selectedRecord && !showConnections ? selectedRecord.url : undefined}
          title={selectedRecord && !showConnections ? "SSE Logs" : "SSE DevTools"}
          onBack={records.length > 1 ? () => setIsDetailVisible(false) : undefined}
          onClose={onToggle}
          onToggleTheme={onToggleTheme}
        />

        <View style={styles.body}>
          {showConnections ? (
            <ConnectionList
              palette={palette}
              records={records}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setIsDetailVisible(true);
              }}
            />
          ) : selectedRecord ? (
            <DetailPane
              clearEvents={clearEvents}
              palette={palette}
              record={selectedRecord}
              onCopyPayload={onCopyPayload}
              onExportEvents={onExportEvents}
            />
          ) : (
            <EmptyState palette={palette} text="No active SSE connections." />
          )}
        </View>
      </View>
    </View>
  );
});

function clampPanelHeight(height: number, minHeight: number, maxHeight: number): number {
  return Math.max(minHeight, Math.min(height, maxHeight));
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0
  },
  dragHandle: {
    borderRadius: 999,
    height: 4,
    width: 40
  },
  dragHandleArea: {
    alignItems: "center",
    height: 20,
    justifyContent: "center"
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 99999
  },
  panel: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    bottom: 0,
    left: 8,
    overflow: "hidden",
    position: "absolute",
    right: 8
  }
});
