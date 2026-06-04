import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { ReactNativeDevtoolsSnapshot } from "../registry/types";
import { PALETTES, type DevtoolsTheme } from "../theme/tokens";
import { ConnectionList } from "./connection-list";
import { DetailPane } from "./detail-pane";
import { EmptyState } from "./empty-state";
import { PanelHeader } from "./panel-header";
import { ToggleButton } from "./toggle-button";

export type ReactNativeSSEDevtoolsPanelProps = {
  readonly clients: ReactNativeDevtoolsSnapshot;
  readonly clearEvents: (id: string) => void;
  readonly hideToggleButton: boolean;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly panelHeight: number;
  readonly theme: DevtoolsTheme;
  readonly toggleButtonPosition: "bottom-left" | "bottom-right" | "top-left" | "top-right";
};

export const ReactNativeSSEDevtoolsPanel = memo(function ReactNativeSSEDevtoolsPanel({
  clients,
  clearEvents,
  hideToggleButton,
  isOpen,
  onToggle,
  panelHeight,
  theme,
  toggleButtonPosition
}: ReactNativeSSEDevtoolsPanelProps) {
  const palette = PALETTES[theme];
  const records = useMemo(() => Array.from(clients.values()), [clients]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (records.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !clients.has(selectedId)) {
      setSelectedId(records[0].id);
    }
  }, [clients, records, selectedId]);

  const selectedRecord = selectedId ? (clients.get(selectedId) ?? null) : null;

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
            height: panelHeight
          }
        ]}
      >
        <PanelHeader connectionCount={records.length} palette={palette} onClose={onToggle} />

        <View style={styles.body}>
          <ConnectionList
            palette={palette}
            records={records}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <View style={[styles.detail, { borderColor: palette.borderSoft }]}>
            {selectedRecord ? (
              <DetailPane clearEvents={clearEvents} palette={palette} record={selectedRecord} />
            ) : (
              <EmptyState palette={palette} text="No active SSE connections." />
            )}
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  body: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0
  },
  detail: {
    flex: 1,
    minWidth: 0
  },
  overlay: {
    bottom: 0,
    left: 0,
    padding: 12,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 99999
  },
  panel: {
    borderRadius: 10,
    borderWidth: 1,
    bottom: 16,
    left: 12,
    overflow: "hidden",
    position: "absolute",
    right: 12
  }
});
