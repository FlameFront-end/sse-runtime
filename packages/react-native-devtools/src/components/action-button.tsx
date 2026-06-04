import { Pressable, StyleSheet, Text } from "react-native";

import type { DevtoolsPalette } from "../theme/tokens";

export function ActionButton({
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

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700"
  }
});
