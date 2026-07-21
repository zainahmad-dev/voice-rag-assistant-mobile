import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";

export type MessageBubbleProps = {
  /** Who sent the message; controls alignment and styling. */
  role: "user" | "assistant";
  content: string;
  /** Retrieval info shown under assistant replies, e.g. "similarity 0.87". */
  source?: string;
};

/**
 * One conversation turn: user messages are right-aligned moss-filled bubbles,
 * assistant messages are left-aligned surface cards with a hairline border and
 * an optional monospace source line.
 */
export function MessageBubble({ role, content, source }: MessageBubbleProps) {
  const { palette } = useTheme();

  if (role === "user") {
    return (
      <View
        style={[
          styles.bubble,
          styles.userBubble,
          { backgroundColor: palette.moss },
        ]}
      >
        <Text style={[styles.content, { color: palette.bubbleText }]}>
          {content}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bubble,
        styles.assistantBubble,
        { backgroundColor: palette.surface, borderColor: palette.line },
      ]}
    >
      <Text style={[styles.content, { color: palette.ink }]}>{content}</Text>
      {source ? (
        <Text style={[styles.source, { color: palette.inkSoft }]}>
          {source}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userBubble: {
    alignSelf: "flex-end",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    fontFamily: fonts.body.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  source: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    marginTop: spacing.sm,
  },
});
