import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { STORAGE_KEYS } from "../lib/storage";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Retrieval info for assistant replies, e.g. "similarity 0.87". */
  source?: string;
  /** Unix epoch ms. */
  createdAt: number;
};

/** Caller supplies the content; the store stamps id and createdAt. */
export type NewMessage = Omit<ConversationMessage, "id" | "createdAt">;

type ConversationState = {
  messages: ConversationMessage[];
  addMessage: (message: NewMessage) => void;
  clear: () => void;
};

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * How many turns are kept on disk. The transcript is append-only and never
 * expires, so without a cap one AsyncStorage row grows forever — and it is
 * rewritten in full on every message. The in-memory list is untouched; only
 * what gets written is trimmed.
 */
const MAX_PERSISTED_MESSAGES = 200;

/**
 * Single shared history: voice turns (VAPI, wired in a later phase) and text
 * queries both append here in the order they happened, so the transcript
 * reads as one conversation regardless of which input drove a given turn.
 *
 * Persisted to AsyncStorage so the conversation survives app restart.
 * Hydration is async, so messages appear one tick after first mount.
 */
export const useConversationStore = create<ConversationState>()(
  persist(
    (set) => ({
      messages: [],
      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            { ...message, id: createId(), createdAt: Date.now() },
          ],
        })),
      clear: () => set({ messages: [] }),
    }),
    {
      name: STORAGE_KEYS.conversation,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Writes run after every `addMessage`/`clear`, so this is the whole
      // save path — keep it to the transcript and cap what it can grow to.
      partialize: (state) => ({
        messages: state.messages.slice(-MAX_PERSISTED_MESSAGES),
      }),
      onRehydrateStorage: () => (_state, error) => {
        // A corrupt or partial blob must not wedge startup: zustand keeps the
        // initial empty list, and the next message writes a clean one.
        if (error) console.warn("[conversation] failed to restore", error);
      },
    },
  ),
);

/**
 * True once the stored transcript has been read back. Screens use it to tell
 * "no messages yet" apart from "messages not loaded yet" — hydration is async,
 * so the store is briefly empty on first mount even when history exists.
 */
export function useConversationHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useConversationStore.persist.hasHydrated(),
  );

  useEffect(() => {
    // Both hooks fire for a rehydrate; `hasHydrated` stays true afterwards.
    const unsubFinish = useConversationStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    setHydrated(useConversationStore.persist.hasHydrated());
    return unsubFinish;
  }, []);

  return hydrated;
}
