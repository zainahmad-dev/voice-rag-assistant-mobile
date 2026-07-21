import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Send } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";
import { MessageBubble } from "../components/MessageBubble";
import { VoiceOrb } from "../components/VoiceOrb";
import { Loading } from "../components/Loading";
import { askQuestion } from "../lib/api";
import {
  useConversationStore,
  type ConversationMessage,
} from "../store/conversationStore";

export function AssistantScreen() {
  const { palette } = useTheme();
  // On iOS the tab bar sits between the screen and the keyboard, so the
  // avoiding view must offset by its height. Android is edge-to-edge with
  // softwareKeyboardLayoutMode "resize" (SDK 54 default), which resizes the
  // window for us — no behavior needed there.
  const tabBarHeight = useBottomTabBarHeight();

  const listRef = useRef<FlatList<ConversationMessage>>(null);
  const messages = useConversationStore((state) => state.messages);
  const addMessage = useConversationStore((state) => state.addMessage);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);

  const canSend = draft.trim().length > 0 && !asking;

  // Keeps the newest message (or the loading row) in view. Fired from the
  // list's onContentSizeChange so it covers store hydration too.
  const scrollToNewest = useCallback(() => {
    if (messages.length === 0) return;
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const question = draft.trim();
    if (!question || asking) return;

    setDraft("");
    addMessage({ role: "user", content: question });
    setAsking(true);
    try {
      const { answer, sources } = await askQuestion(question);
      const top = sources[0];
      addMessage({
        role: "assistant",
        content: answer,
        source: top ? `similarity ${top.similarity.toFixed(2)}` : undefined,
      });
    } catch (err) {
      console.warn("[query] failed", err);
      addMessage({
        role: "assistant",
        content: `Sorry — I couldn't answer that. ${
          err instanceof Error ? err.message : "Please try again."
        }`,
      });
    } finally {
      setAsking(false);
    }
  }, [draft, asking, addMessage]);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? tabBarHeight : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(message) => message.id}
          renderItem={({ item }) => (
            <MessageBubble
              role={item.role}
              content={item.content}
              source={item.source}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: palette.inkSoft }]}>
                Ask a question about your documents — by voice or text.
              </Text>
            </View>
          }
          ListFooterComponent={
            asking ? <Loading label="Searching your documents…" /> : null
          }
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToNewest}
        />

        <View style={styles.orbArea}>
          <VoiceOrb state="idle" />
        </View>

        <View
          style={[
            styles.inputBar,
            { backgroundColor: palette.bg, borderTopColor: palette.line },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a question…"
            placeholderTextColor={palette.inkSoft}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            accessibilityLabel="Question input"
            style={[
              styles.input,
              {
                backgroundColor: palette.surface,
                borderColor: palette.line,
                color: palette.ink,
              },
            ]}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send question"
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: palette.moss,
                opacity: !canSend ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Send color={palette.bg} size={18} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  orbArea: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.body.regular,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
