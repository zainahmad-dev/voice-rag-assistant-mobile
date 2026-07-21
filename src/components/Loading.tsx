import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";

/** Inline loading row shown while waiting, e.g. "Searching your documents…". */
export function Loading({ label = "Loading…" }: { label?: string }) {
  const { palette } = useTheme();

  return (
    <View style={styles.row}>
      <ActivityIndicator size="small" color={palette.moss} />
      <Text style={[styles.label, { color: palette.inkSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  label: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
  },
});
