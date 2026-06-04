import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";

import { canExpandData, expandedData, formatData, formatTime } from "../lib/format";
import type { ReactNativeDevtoolsEventEntry } from "../registry/types";
import type { DevtoolsPalette } from "../theme/tokens";

type EventRowProps = {
  readonly event: ReactNativeDevtoolsEventEntry;
  readonly onCopyPayload?: (payload: string) => void | Promise<void>;
  readonly palette: DevtoolsPalette;
  readonly onSelectType: (type: string) => void;
};

export const EventRow = memo(function EventRow({
  event,
  onCopyPayload,
  palette,
  onSelectType
}: EventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const canExpand = canExpandData(event.data);
  const payload = expandedData(event.data);
  const preview = formatData(event.data);
  const selectType = useCallback(
    (pressEvent: GestureResponderEvent) => {
      pressEvent.stopPropagation();
      onSelectType(event.type);
    },
    [event.type, onSelectType]
  );
  const toggleExpanded = useCallback(() => {
    if (canExpand) setExpanded((current) => !current);
  }, [canExpand]);
  const copyPayload = useCallback(
    (pressEvent: GestureResponderEvent) => {
      pressEvent.stopPropagation();

      if (!onCopyPayload) {
        setCopyState("failed");
        return;
      }

      void Promise.resolve(onCopyPayload(payload)).then(
        () => {
          setCopyState("copied");
          setTimeout(() => setCopyState("idle"), 1200);
        },
        () => setCopyState("failed")
      );
    },
    [onCopyPayload, payload]
  );

  return (
    <Pressable
      accessibilityRole={canExpand ? "button" : undefined}
      style={[
        styles.eventRow,
        {
          backgroundColor: expanded ? palette.card : palette.background,
          borderBottomColor: palette.borderSoft
        }
      ]}
      onPress={toggleExpanded}
    >
      <View style={styles.eventHeader}>
        <Pressable
          onPress={selectType}
          style={[styles.eventTypePill, { borderColor: palette.border }]}
        >
          <Text style={[styles.eventType, { color: palette.accent }]}>{event.type}</Text>
        </Pressable>
        <Text style={[styles.eventTime, { color: palette.textMuted }]}>
          {formatTime(event.timestamp)}
        </Text>
      </View>
      <Text style={[styles.eventData, { color: palette.text }]}>
        {expanded ? payload : preview}
      </Text>
      <View style={styles.eventActions}>
        <Pressable accessibilityRole="button" onPress={copyPayload}>
          <Text style={[styles.eventActionText, { color: palette.textMuted }]}>
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy unavailable"
                : "Copy"}
          </Text>
        </Pressable>
        {canExpand ? (
          <Text style={[styles.eventActionText, { color: palette.textMuted }]}>
            {expanded ? "Hide" : "View"}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  eventData: {
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6
  },
  eventHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  eventActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    marginTop: 8
  },
  eventActionText: {
    fontSize: 10,
    fontWeight: "700"
  },
  eventRow: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  eventTime: {
    fontFamily: "monospace",
    fontSize: 10
  },
  eventType: {
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700"
  },
  eventTypePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  }
});
