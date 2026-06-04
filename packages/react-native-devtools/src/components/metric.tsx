import { StyleSheet, Text, View } from "react-native";

import type { DevtoolsPalette } from "../theme/tokens";

export function Metric({
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

const styles = StyleSheet.create({
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
  metricValue: {
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  }
});
