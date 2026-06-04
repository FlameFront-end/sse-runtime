import { Pressable, StyleSheet, Text, type ViewStyle } from "react-native";

import type { DevtoolsPalette } from "../theme/tokens";
import type { ReactNativeSSEDevtoolsPanelProps } from "./sse-devtools-panel";

type ToggleButtonProps = {
  readonly connectionCount: number;
  readonly hasError: boolean;
  readonly palette: DevtoolsPalette;
  readonly position: ReactNativeSSEDevtoolsPanelProps["toggleButtonPosition"];
  readonly onPress: () => void;
};

export function ToggleButton({
  connectionCount,
  hasError,
  palette,
  position,
  onPress
}: ToggleButtonProps) {
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

const styles = StyleSheet.create({
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
