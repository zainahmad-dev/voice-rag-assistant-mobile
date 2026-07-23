import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FileText, Trash2 } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";
import type { DocumentRecord } from "../lib/api";

type DocumentCardProps = {
  document: DocumentRecord;
  /** Called when the delete button is tapped. */
  onDelete: () => void;
  /** Shows a spinner on the delete button while the delete request runs. */
  deleting?: boolean;
};

export function DocumentCard({
  document,
  onDelete,
  deleting = false,
}: DocumentCardProps) {
  const { palette } = useTheme();

  const indexing =
    document.status === "pending" || document.status === "processing";
  const failed = document.status === "failed";

  const iconColor = failed
    ? palette.alert
    : indexing
      ? palette.ochre
      : palette.moss;

  // "1A" ≈ 10% alpha — the alert tint (no dedicated token, matches web danger/10).
  // A failed row is a dead end unless it says what to do about it, so the
  // backend's reason (when there is one) is paired with the way out.
  const badge = failed
    ? {
        bg: `${palette.alert}1A`,
        fg: palette.alert,
        label: document.error_message
          ? `Couldn't process this file: ${document.error_message} — delete it and try uploading again.`
          : "Couldn't process this file. Delete it and try uploading again.",
      }
    : indexing
      ? { bg: palette.ochreTint, fg: palette.ochre, label: "Indexing…" }
      : {
          bg: palette.mossTint,
          fg: palette.moss,
          label: `Ready · ${document.chunk_count} chunks`,
        };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.line },
      ]}
    >
      <View style={styles.row}>
        <FileText size={20} color={iconColor} />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.name, { color: palette.ink }]}
        >
          {document.file_name}
        </Text>
        <Pressable
          onPress={onDelete}
          disabled={deleting}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${document.file_name}`}
          accessibilityState={{ disabled: deleting, busy: deleting }}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && { backgroundColor: `${palette.alert}1A` },
          ]}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={palette.inkSoft} />
          ) : (
            <Trash2 size={16} color={palette.inkSoft} />
          )}
        </Pressable>
      </View>

      <View
        style={[
          styles.badge,
          { backgroundColor: badge.bg },
          failed && styles.badgeFailed,
        ]}
      >
        <Text
          numberOfLines={failed ? 3 : 1}
          style={[styles.badgeText, { color: badge.fg }]}
        >
          {badge.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: fonts.body.medium,
    fontSize: 14,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    // Indent past the file icon so the badge lines up with the name.
    marginLeft: 20 + spacing.sm,
  },
  badgeFailed: {
    // Error messages can be long — let the pill use the full card width.
    alignSelf: "stretch",
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: fonts.body.medium,
    fontSize: 11,
  },
});
