import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { RATE_WINDOW_MS } from "../constants";
import { formatAgo, formatData, formatDuration } from "../lib/format";
import type { ReactNativeDevtoolsClientRecord } from "../registry/types";
import { statusColor, statusLabel, type DevtoolsPalette } from "../theme/tokens";
import { ActionButton } from "./action-button";
import { EmptyState } from "./empty-state";
import { EventRow } from "./event-row";
import { Metric } from "./metric";
import { StatusDot } from "./status-dot";

type DetailPaneProps = {
  readonly clearEvents: (id: string) => void;
  readonly palette: DevtoolsPalette;
  readonly record: ReactNativeDevtoolsClientRecord;
};

export const DetailPane = memo(function DetailPane({
  clearEvents,
  palette,
  record
}: DetailPaneProps) {
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
  const togglePause = useCallback(() => setPaused((value) => !value), []);

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
        <ActionButton label={paused ? "Resume" : "Pause"} palette={palette} onPress={togglePause} />
        <ActionButton label="Clear" palette={palette} onPress={clear} />
      </View>

      <ScrollView style={styles.events}>
        {filteredEvents.length === 0 ? (
          <EmptyState palette={palette} text="No events to display." />
        ) : (
          filteredEvents.map((event) => (
            <EventRow key={event.id} event={event} palette={palette} onSelectType={setQuery} />
          ))
        )}
      </ScrollView>
    </View>
  );
});

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
  actions: {
    flexDirection: "row",
    flexShrink: 0,
    gap: 6
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
  events: {
    flex: 1
  },
  eventToolbar: {
    alignItems: "center",
    borderBottomWidth: 1,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    padding: 8
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
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 8
  }
});
