import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Moon, Sun } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";

// Placeholder until the document list is wired to real data (phases 14–17).
const DOCUMENT_COUNT: number = 0;

export function LibraryScreen() {
  const { palette, mode, toggle } = useTheme();
  const count = DOCUMENT_COUNT;

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: palette.ink }]}>
            Voice RAG Assistant
          </Text>
          <Text style={[styles.subtitle, { color: palette.inkSoft }]}>
            {count} {count === 1 ? "document" : "documents"} indexed
          </Text>
        </View>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={
            mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          style={({ pressed }) => [
            styles.toggleButton,
            {
              backgroundColor: palette.surface,
              borderColor: palette.line,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          {mode === "dark" ? (
            <Sun color={palette.ochre} size={20} />
          ) : (
            <Moon color={palette.moss} size={20} />
          )}
        </Pressable>
      </View>
      {/* Body (upload button + document list) arrives in phase 14 */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerText: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontFamily: fonts.display.semiBold,
    fontSize: 20,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
