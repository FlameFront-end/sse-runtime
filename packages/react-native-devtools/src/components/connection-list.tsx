import { memo, useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { urlLabel } from "../lib/format";
import type { ReactNativeDevtoolsClientRecord } from "../registry/types";
import { statusColor, statusLabel, type DevtoolsPalette } from "../theme/tokens";
import { EmptyState } from "./empty-state";
import { StatusDot } from "./status-dot";

type ConnectionListProps = {
  readonly palette: DevtoolsPalette;
  readonly records: readonly ReactNativeDevtoolsClientRecord[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
};

export const ConnectionList = memo(function ConnectionList({
  palette,
  records,
  selectedId,
  onSelect
}: ConnectionListProps) {
  if (records.length === 0) {
    return (
      <View style={[styles.connections, { borderRightColor: palette.borderSoft }]}>
        <EmptyState palette={palette} text="Wrap your app with ReactNativeSSEDevtoolsProvider." />
      </View>
    );
  }

  return (
    <View style={[styles.connections, { borderRightColor: palette.borderSoft }]}>
      <ScrollView>
        {records.map((record) => (
          <ConnectionItem
            key={record.id}
            palette={palette}
            record={record}
            selected={record.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  connectionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 16
  },
  connectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6
  },
  connectionItem: {
    borderBottomWidth: 1,
    borderLeftWidth: 2,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  connectionMeta: {
    fontSize: 10
  },
  connections: {
    borderRightWidth: 1,
    flexShrink: 0,
    width: 164
  },
  connectionStatus: {
    fontSize: 10,
    fontWeight: "600"
  },
  connectionUrl: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "600"
  },
  role: {
    fontSize: 10,
    paddingLeft: 16
  }
});

type ConnectionItemProps = {
  readonly palette: DevtoolsPalette;
  readonly record: ReactNativeDevtoolsClientRecord;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
};

const ConnectionItem = memo(function ConnectionItem({
  palette,
  record,
  selected,
  onSelect
}: ConnectionItemProps) {
  const color = statusColor(record.status, palette);
  const select = useCallback(() => onSelect(record.id), [onSelect, record.id]);

  return (
    <Pressable
      accessibilityRole="button"
      style={[
        styles.connectionItem,
        {
          backgroundColor: selected ? palette.selected : palette.background,
          borderBottomColor: palette.borderSoft,
          borderLeftColor: selected ? palette.accent : "transparent"
        }
      ]}
      onPress={select}
    >
      <View style={styles.connectionHeader}>
        <StatusDot color={color} />
        <Text numberOfLines={1} style={[styles.connectionUrl, { color: palette.text }]}>
          {urlLabel(record.url)}
        </Text>
      </View>
      <View style={styles.connectionFooter}>
        <Text style={[styles.connectionStatus, { color }]}>{statusLabel(record.status)}</Text>
        <Text style={[styles.connectionMeta, { color: palette.textMuted }]}>
          {record.totalEvents} evt
        </Text>
      </View>
      {record.role && (
        <Text style={[styles.role, { color: palette.textMuted }]}>{record.role}</Text>
      )}
    </Pressable>
  );
});
