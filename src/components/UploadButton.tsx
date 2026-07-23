import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { UploadCloud } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";
import { Loading } from "./Loading";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_MB } from "../lib/upload";

export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

type UploadButtonProps = {
  /** Called with the selected file once the user picks one. */
  onPick: (file: PickedFile) => void;
  /** Called with a user-facing message when the picker itself fails. */
  onError?: (message: string) => void;
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

export function UploadButton({
  onPick,
  onError,
  uploading = false,
}: UploadButtonProps) {
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
      if (!asset) {
        onError?.(
          "No file came back from the picker. Please try selecting it again.",
        );
        return;
      }

      onPick({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? inferMimeType(asset.name),
        size: asset.size,
      });
    } catch (err) {
      // Storage-provider failures (a cloud file that can't be downloaded, a
      // revoked permission) reject here rather than returning `canceled`.
      console.warn("[picker] failed", err);
      onError?.(
        "Couldn't open the file picker. Check that this app is allowed to access files, then try again.",
      );
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
      accessibilityHint={`Opens the file picker. PDF, DOCX, and TXT files up to ${MAX_FILE_SIZE_MB} MB are accepted.`}
      accessibilityState={{ disabled, busy: disabled }}
      style={({ pressed }) => [
        styles.zone,
        {
          borderColor: pressed ? palette.moss : palette.line,
          backgroundColor: pressed ? palette.mossTint : palette.surface,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {uploading || picking ? (
        <Loading
          centered
          size="large"
          label={uploading ? "Uploading…" : "Opening files…"}
        />
      ) : (
        <>
          <UploadCloud color={palette.moss} size={28} />
          <Text style={[styles.title, { color: palette.ink }]}>
            Tap to upload a document
          </Text>
          <Text style={[styles.hint, { color: palette.inkSoft }]}>
            PDF, DOCX, or TXT · up to {MAX_FILE_SIZE_MB} MB
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
