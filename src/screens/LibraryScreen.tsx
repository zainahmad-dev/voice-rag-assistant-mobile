import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Moon, Sun } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";
import { UploadButton, type PickedFile } from "../components/UploadButton";
import { DocumentCard } from "../components/DocumentCard";
import { EmptyState } from "../components/EmptyState";
import { uploadDocument, type DocumentRecord } from "../lib/api";

// Mock data exercising all three card states — replaced by the real API in
// phases 15–17.
const MOCK_DOCUMENTS: DocumentRecord[] = [
  {
    id: "1",
    file_name: "quarterly-report-2026.pdf",
    file_type: "pdf",
    storage_path: "1/quarterly-report-2026.pdf",
    status: "completed",
    chunk_count: 42,
    error_message: null,
    created_at: "2026-07-15T10:24:00Z",
  },
  {
    id: "2",
    file_name: "meeting-notes-with-a-really-long-filename-example.docx",
    file_type: "docx",
    storage_path: "2/meeting-notes-with-a-really-long-filename-example.docx",
    status: "processing",
    chunk_count: 0,
    error_message: null,
    created_at: "2026-07-17T08:02:00Z",
  },
  {
    id: "3",
    file_name: "corrupted-scan.pdf",
    file_type: "pdf",
    storage_path: "3/corrupted-scan.pdf",
    status: "failed",
    chunk_count: 0,
    error_message: "Could not extract text from this PDF.",
    created_at: "2026-07-16T18:40:00Z",
  },
];

export function LibraryScreen() {
  const { palette, mode, toggle } = useTheme();
  const [documents, setDocuments] = useState<DocumentRecord[]>(MOCK_DOCUMENTS);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const indexedCount = documents.filter(
    (doc) => doc.status === "completed",
  ).length;

  // Simulated refresh until the API client lands in phase 15.
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setDocuments(MOCK_DOCUMENTS);
      setRefreshing(false);
    }, 800);
  }, []);

  // Minimal test hook so the upload flow (and its trace logging) actually runs.
  // The full flow — refetch on success + status polling — arrives in phase 17.
  const handlePick = useCallback(async (file: PickedFile) => {
    setUploading(true);
    try {
      const doc = await uploadDocument(file);
      console.log("[upload] done", { id: doc.id, status: doc.status });
    } catch (err) {
      console.warn("[upload] failed", err);
      Alert.alert(
        "Upload failed",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

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
            {indexedCount} {indexedCount === 1 ? "document" : "documents"}{" "}
            indexed
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

      <FlatList
        data={documents}
        keyExtractor={(doc) => doc.id}
        renderItem={({ item }) => (
          <DocumentCard
            document={item}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.uploadWrapper}>
            <UploadButton onPick={handlePick} uploading={uploading} />
          </View>
        }
        ListEmptyComponent={<EmptyState />}
        ItemSeparatorComponent={Separator}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={palette.moss}
            colors={[palette.moss]}
            progressBackgroundColor={palette.surface}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  uploadWrapper: {
    marginBottom: spacing.lg,
  },
  separator: {
    height: spacing.sm,
  },
});
