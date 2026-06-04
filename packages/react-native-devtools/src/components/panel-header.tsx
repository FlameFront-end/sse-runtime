import type { SSEConnectionStatus } from "@flamefrontend/sse-runtime-core";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { statusColor, type DevtoolsPalette } from "../theme/tokens";
import { StatusDot } from "./status-dot";

type PanelHeaderProps = {
  readonly connectionCount: number;
  readonly isDetailVisible: boolean;
  readonly palette: DevtoolsPalette;
  readonly status?: SSEConnectionStatus;
  readonly subtitle?: string;
  readonly title?: string;
  readonly onBack?: () => void;
  readonly onClose: () => void;
  readonly onToggleTheme: () => void;
};

export function PanelHeader({
  connectionCount,
  isDetailVisible,
  palette,
  status,
  subtitle,
  title = "SSE DevTools",
  onBack,
  onClose,
  onToggleTheme
}: PanelHeaderProps) {
  return (
    <View style={[styles.header, { borderBottomColor: palette.border }]}>
      <View style={styles.titleRow}>
        {isDetailVisible && onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show SSE connections"
            style={[
              styles.backButton,
              { backgroundColor: palette.button, borderColor: palette.border }
            ]}
            onPress={onBack}
          >
            <Text style={[styles.backText, { color: palette.text }]}>‹</Text>
          </Pressable>
        ) : null}
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={[styles.title, { color: palette.text }]}>
            {title}
          </Text>
          <View style={styles.subtitleRow}>
            {status ? <StatusDot color={statusColor(status, palette)} /> : null}
            <Text numberOfLines={1} style={[styles.subtitle, { color: palette.textMuted }]}>
              {subtitle ?? `${connectionCount} connection${connectionCount === 1 ? "" : "s"}`}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle SSE DevTools theme"
          style={[
            styles.closeButton,
            { backgroundColor: palette.button, borderColor: palette.border }
          ]}
          onPress={onToggleTheme}
        >
          <Text style={[styles.closeText, { color: palette.text }]}>Theme</Text>
        </Pressable>
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
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  backText: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 26
  },
  closeButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  closeText: {
    fontSize: 12,
    fontWeight: "600"
  },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  headerActions: {
    flexDirection: "row",
    flexShrink: 0,
    gap: 6
  },
  subtitle: {
    flex: 1,
    fontSize: 11,
    minWidth: 0
  },
  subtitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
    minWidth: 0
  },
  titleBlock: {
    flex: 1,
    minWidth: 0
  },
  titleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0
  },
  title: {
    fontSize: 15,
    fontWeight: "700"
  }
});
