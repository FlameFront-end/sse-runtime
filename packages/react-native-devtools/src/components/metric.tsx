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
    borderRadius: 9,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  metricLabel: {
    fontSize: 10,
    textTransform: "uppercase"
  },
  metricValue: {
    fontFamily: "monospace",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4
  }
});
