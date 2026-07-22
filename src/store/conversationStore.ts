import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
      name: "conversation",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
);
