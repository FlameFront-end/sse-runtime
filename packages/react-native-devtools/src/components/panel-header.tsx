import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DevtoolsPalette } from "../theme/tokens";

type PanelHeaderProps = {
  readonly connectionCount: number;
  readonly palette: DevtoolsPalette;
  readonly onClose: () => void;
};

export function PanelHeader({ connectionCount, palette, onClose }: PanelHeaderProps) {
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

const styles = StyleSheet.create({
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
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2
  },
  title: {
    fontSize: 14,
    fontWeight: "700"
  }
});
