import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { UploadCloud } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";
import { ACCEPTED_MIME_TYPES } from "../lib/upload";

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

type UploadButtonProps = {
  /** Called with the selected file once the user picks one. */
  onPick: (file: PickedFile) => void;
  /** Shows the spinner state while the parent is uploading. */
  uploading?: boolean;
};

/** Android may omit mimeType for some providers — fall back to the extension. */
function inferMimeType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

export function UploadButton({ onPick, uploading = false }: UploadButtonProps) {
  const { palette } = useTheme();
  // Guards against double-opening the system picker with a second tap.
  const [picking, setPicking] = useState(false);

  const disabled = uploading || picking;

  async function handlePress() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [...ACCEPTED_MIME_TYPES],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      onPick({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? inferMimeType(asset.name),
        size: asset.size,
      });
    } finally {
      setPicking(false);
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Upload a document"
      accessibilityHint="Opens the file picker. PDF, DOCX, and TXT files are accepted."
      accessibilityState={{ disabled, busy: uploading }}
      style={({ pressed }) => [
        styles.zone,
        {
          borderColor: pressed ? palette.moss : palette.line,
          backgroundColor: pressed ? palette.mossTint : palette.surface,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {uploading ? (
        <>
          <ActivityIndicator color={palette.moss} />
          <Text style={[styles.title, { color: palette.ink }]}>Uploading…</Text>
        </>
      ) : (
        <>
          <UploadCloud color={palette.moss} size={28} />
          <Text style={[styles.title, { color: palette.ink }]}>
            Tap to upload a document
          </Text>
          <Text style={[styles.hint, { color: palette.inkSoft }]}>
            PDF, DOCX, or TXT
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  zone: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
  },
  hint: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
  },
});
