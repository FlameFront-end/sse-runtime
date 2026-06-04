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
      <View style={styles.connections}>
        <EmptyState palette={palette} text="Wrap your app with ReactNativeSSEDevtoolsProvider." />
      </View>
    );
  }

  return (
    <View style={styles.connections}>
      <ScrollView contentContainerStyle={styles.content}>
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
      accessibilityLabel={`Inspect SSE connection ${record.url}`}
      style={[
        styles.connectionItem,
        {
          backgroundColor: selected ? palette.selected : palette.card,
          borderColor: selected ? palette.accent : palette.border
        }
      ]}
      onPress={select}
    >
      <View style={styles.connectionHeader}>
        <View style={styles.connectionTitle}>
          <StatusDot color={color} />
          <Text numberOfLines={1} style={[styles.connectionUrl, { color: palette.text }]}>
            {urlLabel(record.url)}
          </Text>
        </View>
        <Text style={[styles.inspectText, { color: palette.accent }]}>Open</Text>
      </View>

      <View style={styles.connectionFooter}>
        <Text style={[styles.connectionStatus, { color }]}>{statusLabel(record.status)}</Text>
        <Text style={[styles.connectionMeta, { color: palette.textMuted }]}>
          {record.totalEvents} evt
        </Text>
      </View>

      {record.role ? (
        <Text style={[styles.role, { color: palette.textMuted }]}>{record.role}</Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  connectionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 18
  },
  connectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between"
  },
  connectionItem: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  connectionMeta: {
    fontSize: 11
  },
  connections: {
    flex: 1,
    minHeight: 0
  },
  connectionStatus: {
    fontSize: 11,
    fontWeight: "600"
  },
  connectionTitle: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0
  },
  connectionUrl: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "600"
  },
  content: {
    gap: 10,
    padding: 12,
    paddingBottom: 18
  },
  inspectText: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: "700"
  },
  role: {
    fontSize: 10,
    paddingLeft: 18
  }
});
