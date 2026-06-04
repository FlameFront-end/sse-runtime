import { StyleSheet, Text, View } from "react-native";

import type { DevtoolsPalette } from "../theme/tokens";

export function EmptyState({
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

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  emptyText: {
    fontSize: 12,
    textAlign: "center"
  }
});
