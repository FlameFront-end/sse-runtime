import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle
} from "react-native";

import { RATE_WINDOW_MS } from "../constants";
import {
  expandedData,
  formatAgo,
  formatData,
  formatDuration,
  formatTime,
  urlLabel
} from "../lib/format";
import type {
  ReactNativeDevtoolsClientRecord,
  ReactNativeDevtoolsSnapshot
} from "../registry/types";
import {
  PALETTES,
  type DevtoolsPalette,
  type DevtoolsTheme,
  statusColor,
  statusLabel
} from "../theme/tokens";

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

function ToggleButton({
  connectionCount,
  hasError,
  palette,
  position,
  onPress
}: {
  readonly connectionCount: number;
  readonly hasError: boolean;
  readonly palette: DevtoolsPalette;
  readonly position: ReactNativeSSEDevtoolsPanelProps["toggleButtonPosition"];
  readonly onPress: () => void;
}) {
  const positionStyle: ViewStyle = {
    bottom: position.startsWith("bottom") ? 24 : undefined,
    top: position.startsWith("top") ? 56 : undefined,
    left: position.endsWith("left") ? 16 : undefined,
    right: position.endsWith("right") ? 16 : undefined
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open SSE DevTools"
      style={[
        styles.toggle,
        positionStyle,
        {
          backgroundColor: palette.background,
          borderColor: hasError ? palette.danger : palette.border
        }
      ]}
      onPress={onPress}
    >
      <Text style={[styles.toggleText, { color: palette.text }]}>SSE</Text>
      <Text style={[styles.toggleCount, { color: hasError ? palette.danger : palette.textMuted }]}>
        {connectionCount}
      </Text>
    </Pressable>
  );
}

function PanelHeader({
  connectionCount,
  palette,
  onClose
}: {
  readonly connectionCount: number;
  readonly palette: DevtoolsPalette;
  readonly onClose: () => void;
}) {
  return (
    <View style={[styles.header, { borderBottomColor: palette.border }]}>
      <View>
        <Text style={[styles.title, { color: palette.text }]}>SSE DevTools</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          {connectionCount} connection{connectionCount === 1 ? "" : "s"}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close SSE DevTools"
        style={[
          styles.closeButton,
          { backgroundColor: palette.button, borderColor: palette.border }
        ]}
        onPress={onClose}
      >
        <Text style={[styles.closeText, { color: palette.text }]}>Close</Text>
      </Pressable>
    </View>
  );
}

function ConnectionList({
  palette,
  records,
  selectedId,
  onSelect
}: {
  readonly palette: DevtoolsPalette;
  readonly records: readonly ReactNativeDevtoolsClientRecord[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
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
        {records.map((record) => {
          const selected = record.id === selectedId;
          const color = statusColor(record.status, palette);

          return (
            <Pressable
              key={record.id}
              accessibilityRole="button"
              style={[
                styles.connectionItem,
                {
                  backgroundColor: selected ? palette.selected : palette.background,
                  borderBottomColor: palette.borderSoft,
                  borderLeftColor: selected ? palette.accent : "transparent"
                }
              ]}
              onPress={() => onSelect(record.id)}
            >
              <View style={styles.connectionHeader}>
                <StatusDot color={color} />
                <Text numberOfLines={1} style={[styles.connectionUrl, { color: palette.text }]}>
                  {urlLabel(record.url)}
                </Text>
              </View>
              <View style={styles.connectionFooter}>
                <Text style={[styles.connectionStatus, { color }]}>
                  {statusLabel(record.status)}
                </Text>
                <Text style={[styles.connectionMeta, { color: palette.textMuted }]}>
                  {record.totalEvents} evt
                </Text>
              </View>
              {record.role && (
                <Text style={[styles.role, { color: palette.textMuted }]}>{record.role}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function DetailPane({
  clearEvents,
  palette,
  record
}: {
  readonly clearEvents: (id: string) => void;
  readonly palette: DevtoolsPalette;
  readonly record: ReactNativeDevtoolsClientRecord;
}) {
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [frozenEvents, setFrozenEvents] = useState(record.events);
  const sourceEvents = paused ? frozenEvents : record.events;

  useEffect(() => {
    if (!paused) setFrozenEvents(record.events);
  }, [paused, record.events]);

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sourceEvents;

    return sourceEvents.filter((event) => {
      return (
        event.type.toLowerCase().includes(normalized) ||
        formatData(event.data).toLowerCase().includes(normalized)
      );
    });
  }, [query, sourceEvents]);

  const now = Date.now();
  const eventsPerSecond = calculateEventsPerSecond(record, now);
  const status = statusColor(record.status, palette);
  const clear = useCallback(() => {
    setFrozenEvents([]);
    clearEvents(record.id);
  }, [clearEvents, record.id]);

  return (
    <View style={styles.detailShell}>
      <View style={[styles.detailHeader, { borderBottomColor: palette.borderSoft }]}>
        <View style={styles.detailTitleBlock}>
          <Text numberOfLines={1} style={[styles.detailUrl, { color: palette.text }]}>
            {record.url}
          </Text>
          <View style={styles.detailMeta}>
            <StatusDot color={status} />
            <Text style={[styles.detailStatus, { color: status }]}>
              {statusLabel(record.status)}
            </Text>
            <Text numberOfLines={1} style={[styles.detailKey, { color: palette.textMuted }]}>
              key {record.key}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <ActionButton
            label="Connect"
            palette={palette}
            onPress={() => void record.client.connect()}
          />
          <ActionButton label="Disconnect" palette={palette} onPress={record.client.disconnect} />
        </View>
      </View>

      {record.error && (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: palette.dangerBackground, borderColor: palette.danger }
          ]}
        >
          <Text style={[styles.errorText, { color: palette.danger }]}>
            {record.error.kind}: {record.error.message}
            {record.error.status != null ? ` (HTTP ${record.error.status})` : ""}
          </Text>
        </View>
      )}

      <View style={styles.metrics}>
        <Metric label="Events" palette={palette} value={record.totalEvents} />
        <Metric label="Events / sec" palette={palette} value={eventsPerSecond} />
        <Metric
          label="Uptime"
          palette={palette}
          value={record.connectedAt ? formatDuration(record.connectedAt, now) : "-"}
        />
        <Metric label="Reconnects" palette={palette} value={record.reconnectCount} />
        <Metric
          label="Last"
          palette={palette}
          value={record.lastEventAt ? formatAgo(record.lastEventAt, now) : "-"}
        />
      </View>

      <View style={[styles.eventToolbar, { borderColor: palette.borderSoft }]}>
        <TextInput
          accessibilityLabel="Filter SSE events"
          placeholder="Filter type or payload"
          placeholderTextColor={palette.muted}
          value={query}
          style={[
            styles.filterInput,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
              color: palette.text
            }
          ]}
          onChangeText={setQuery}
        />
        <ActionButton
          label={paused ? "Resume" : "Pause"}
          palette={palette}
          onPress={() => setPaused((value) => !value)}
        />
        <ActionButton label="Clear" palette={palette} onPress={clear} />
      </View>

      <ScrollView style={styles.events}>
        {filteredEvents.length === 0 ? (
          <EmptyState palette={palette} text="No events to display." />
        ) : (
          filteredEvents.map((event) => (
            <View
              key={event.id}
              style={[styles.eventRow, { borderBottomColor: palette.borderSoft }]}
            >
              <View style={styles.eventHeader}>
                <Pressable onPress={() => setQuery(event.type)}>
                  <Text style={[styles.eventType, { color: palette.accent }]}>{event.type}</Text>
                </Pressable>
                <Text style={[styles.eventTime, { color: palette.textMuted }]}>
                  {formatTime(event.timestamp)}
                </Text>
              </View>
              <Text style={[styles.eventData, { color: palette.text }]}>
                {expandedData(event.data)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Metric({
  label,
  palette,
  value
}: {
  readonly label: string;
  readonly palette: DevtoolsPalette;
  readonly value: string | number;
}) {
  return (
    <View style={[styles.metric, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text style={[styles.metricLabel, { color: palette.textMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  palette,
  onPress
}: {
  readonly label: string;
  readonly palette: DevtoolsPalette;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[
        styles.actionButton,
        { backgroundColor: palette.button, borderColor: palette.border }
      ]}
      onPress={onPress}
    >
      <Text style={[styles.actionText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({
  palette,
  text
}: {
  readonly palette: DevtoolsPalette;
  readonly text: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: palette.textMuted }]}>{text}</Text>
    </View>
  );
}

function StatusDot({ color }: { readonly color: string }) {
  return <View style={[styles.statusDot, { backgroundColor: color }]} />;
}

function calculateEventsPerSecond(record: ReactNativeDevtoolsClientRecord, now: number): number {
  if (record.lastEventAt === null) return 0;

  const since = now - RATE_WINDOW_MS;
  let count = 0;
  for (const timestamp of record.recentEventTimestamps) {
    if (timestamp >= since) count += 1;
  }

  return Math.round((count / (RATE_WINDOW_MS / 1000)) * 10) / 10;
}

const styles = StyleSheet.create({
  actionButton: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  actionText: {
    fontSize: 11,
    fontWeight: "600"
  },
  actions: {
    flexDirection: "row",
    flexShrink: 0,
    gap: 6
  },
  body: {
    flex: 1,
    flexDirection: "row",
    minHeight: 0
  },
  closeButton: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  closeText: {
    fontSize: 12,
    fontWeight: "600"
  },
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
  detail: {
    flex: 1,
    minWidth: 0
  },
  detailHeader: {
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    padding: 10
  },
  detailKey: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: 10
  },
  detailMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 5
  },
  detailShell: {
    flex: 1,
    minHeight: 0
  },
  detailStatus: {
    fontSize: 11,
    fontWeight: "600"
  },
  detailTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  detailUrl: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700"
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  emptyText: {
    fontSize: 12,
    textAlign: "center"
  },
  errorBox: {
    borderRadius: 6,
    borderWidth: 1,
    marginHorizontal: 10,
    marginTop: 8,
    padding: 8
  },
  errorText: {
    fontFamily: "monospace",
    fontSize: 11
  },
  eventData: {
    fontFamily: "monospace",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4
  },
  eventHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  eventRow: {
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  events: {
    flex: 1
  },
  eventTime: {
    fontFamily: "monospace",
    fontSize: 10
  },
  eventToolbar: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    padding: 8
  },
  eventType: {
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700"
  },
  filterInput: {
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    fontFamily: "monospace",
    fontSize: 11,
    height: 32,
    paddingHorizontal: 8
  },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  metric: {
    borderRadius: 7,
    borderWidth: 1,
    minWidth: 78,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  metricLabel: {
    fontSize: 9,
    textTransform: "uppercase"
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 8
  },
  metricValue: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
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
  },
  role: {
    fontSize: 10,
    paddingLeft: 16
  },
  statusDot: {
    borderRadius: 5,
    height: 8,
    width: 8
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2
  },
  title: {
    fontSize: 14,
    fontWeight: "700"
  },
  toggle: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: "absolute",
    zIndex: 99999
  },
  toggleCount: {
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700"
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "800"
  }
});
