import { StyleSheet, View } from "react-native";

export function StatusDot({ color }: { readonly color: string }) {
  return <View style={[styles.statusDot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  statusDot: {
    borderRadius: 5,
    height: 8,
    width: 8
  }
});
