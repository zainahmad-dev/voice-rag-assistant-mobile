import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";

/** Shown in the Library when the document list is empty. */
export function EmptyState() {
  const { palette } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.message, { color: palette.inkSoft }]}>
        No documents yet — upload one to get started.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  message: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
