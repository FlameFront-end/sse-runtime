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
        styles.eventContainer,
        {
          backgroundColor: expanded ? palette.card : palette.background,
          borderBottomColor: palette.borderSoft
        }
      ]}
      onPress={toggleExpanded}
    >
      <View style={styles.eventRow}>
        <Text style={[styles.eventTime, { color: palette.textMuted }]}>
          {formatTime(event.timestamp)}
        </Text>
        <Pressable
          onPress={selectType}
          style={[styles.eventTypePill, { borderColor: palette.border }]}
        >
          <Text style={[styles.eventType, { color: palette.accent }]}>{event.type}</Text>
        </Pressable>
        <Text numberOfLines={1} style={[styles.eventPreview, { color: palette.textMuted }]}>
          {preview}
        </Text>
        <View style={styles.eventActions}>
          <Pressable accessibilityRole="button" onPress={copyPayload}>
            <Text
              style={[
                styles.eventActionText,
                { color: copyState === "copied" ? palette.success : palette.textMuted }
              ]}
            >
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Unavailable" : "Copy"}
            </Text>
          </Pressable>
          {canExpand ? (
            <Text style={[styles.eventActionText, { color: palette.textMuted }]}>
              {expanded ? "Hide" : "View"}
            </Text>
          ) : null}
        </View>
      </View>

      {expanded ? (
        <View
          style={[
            styles.payloadBox,
            { backgroundColor: palette.background, borderColor: palette.border }
          ]}
        >
          <Text style={[styles.payloadText, { color: palette.text }]}>{payload}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  eventActions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 8,
    marginLeft: "auto"
  },
  eventActionText: {
    fontSize: 10,
    fontWeight: "700"
  },
  eventContainer: {
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  eventPreview: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: 11,
    minWidth: 0
  },
  eventRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 32
  },
  eventTime: {
    flexShrink: 0,
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
  },
  payloadBox: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden"
  },
  payloadText: {
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 16,
    padding: 10
  }
});
