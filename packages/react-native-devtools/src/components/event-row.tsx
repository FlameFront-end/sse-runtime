import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { expandedData, formatTime } from "../lib/format";
import type { ReactNativeDevtoolsEventEntry } from "../registry/types";
import type { DevtoolsPalette } from "../theme/tokens";

type EventRowProps = {
  readonly event: ReactNativeDevtoolsEventEntry;
  readonly palette: DevtoolsPalette;
  readonly onSelectType: (type: string) => void;
};

export const EventRow = memo(function EventRow({ event, palette, onSelectType }: EventRowProps) {
  const selectType = useCallback(() => onSelectType(event.type), [event.type, onSelectType]);

  return (
    <View style={[styles.eventRow, { borderBottomColor: palette.borderSoft }]}>
      <View style={styles.eventHeader}>
        <Pressable onPress={selectType}>
          <Text style={[styles.eventType, { color: palette.accent }]}>{event.type}</Text>
        </Pressable>
        <Text style={[styles.eventTime, { color: palette.textMuted }]}>
          {formatTime(event.timestamp)}
        </Text>
      </View>
      <Text style={[styles.eventData, { color: palette.text }]}>{expandedData(event.data)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
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
  eventTime: {
    fontFamily: "monospace",
    fontSize: 10
  },
  eventType: {
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700"
  }
});
