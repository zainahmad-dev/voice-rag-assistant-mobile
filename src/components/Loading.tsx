import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";

type LoadingProps = {
  /** Says what is being waited on, e.g. "Searching your documents…". */
  label?: string;
  /** "small" for inline rows (default), "large" for a whole-area wait. */
  size?: "small" | "large";
  /** Stacks the spinner above the label and centres it — for empty areas. */
  centered?: boolean;
};

/**
 * The app's single loading affordance: a spinner plus a label saying what is
 * happening. Every async operation shows one, so a slow request never looks
 * like a frozen screen.
 */
export function Loading({
  label = "Loading…",
  size = "small",
  centered = false,
}: LoadingProps) {
  const { palette } = useTheme();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={centered ? styles.centered : styles.row}
    >
      <ActivityIndicator size={size} color={palette.moss} />
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
  centered: {
    // No outer padding: callers own the surrounding space (a card's padding, a
    // centred empty-list slot), so this only stacks the spinner and its label.
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    textAlign: "center",
  },
});
