import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import {
  deleteDocument,
  fetchDocuments,
  uploadDocument,
  type DocumentRecord,
} from "../lib/api";

// While any document is still indexing, re-poll the list this often (ms).
const POLL_INTERVAL_MS = 3000;

/** A document is still being indexed while pending or processing. */
function isInProgress(doc: DocumentRecord): boolean {
  return doc.status === "pending" || doc.status === "processing";
}

export function LibraryScreen() {
  const { palette, mode, toggle } = useTheme();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const indexedCount = documents.filter(
    (doc) => doc.status === "completed",
  ).length;
  const anyInProgress = documents.some(isInProgress);

  // Fetches the list from the API. `silent` skips error surfacing for
  // background polls, so a transient blip doesn't replace the list with an error.
  const loadDocuments = useCallback(async (silent = false) => {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      setLoadError(null);
    } catch (err) {
      console.warn("[documents] load failed", err);
      if (!silent) {
        setLoadError(
          err instanceof Error ? err.message : "Could not load documents.",
        );
      }
    }
  }, []);

  // Initial load.
  useEffect(() => {
    void (async () => {
      await loadDocuments();
      setLoading(false);
    })();
  }, [loadDocuments]);

  // Status polling: while any document is still indexing, refetch every few
  // seconds. The interval tears down once nothing is in progress.
  useEffect(() => {
    if (!anyInProgress) return;
    const interval = setInterval(() => {
      void loadDocuments(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [anyInProgress, loadDocuments]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDocuments();
    setRefreshing(false);
  }, [loadDocuments]);

  const handlePick = useCallback(
    async (file: PickedFile) => {
      setUploading(true);
      try {
        await uploadDocument(file);
        // Refetch so the new (pending) row appears; polling handles the rest.
        await loadDocuments();
      } catch (err) {
        console.warn("[upload] failed", err);
        Alert.alert(
          "Upload failed",
          err instanceof Error ? err.message : "Something went wrong.",
        );
      } finally {
        setUploading(false);
      }
    },
    [loadDocuments],
  );

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      console.warn("[delete] failed", err);
      Alert.alert(
        "Delete failed",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setDeletingId(null);
    }
  }, []);

  const listEmpty = loading ? (
    <View style={styles.centerState}>
      <ActivityIndicator color={palette.moss} />
    </View>
  ) : loadError ? (
    <View style={styles.centerState}>
      <Text style={[styles.errorText, { color: palette.alert }]}>
        {loadError}
      </Text>
      <Text style={[styles.errorHint, { color: palette.inkSoft }]}>
        Pull down to try again.
      </Text>
    </View>
  ) : (
    <EmptyState />
  );

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
            deleting={deletingId === item.id}
          />
        )}
        ListHeaderComponent={
          <View style={styles.uploadWrapper}>
            <UploadButton onPick={handlePick} uploading={uploading} />
          </View>
        }
        ListEmptyComponent={listEmpty}
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
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    textAlign: "center",
  },
  errorHint: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    textAlign: "center",
  },
});
