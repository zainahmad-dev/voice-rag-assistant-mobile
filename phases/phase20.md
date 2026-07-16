# Phase 20 — Create the conversation store

Create src/store/conversationStore.ts with Zustand: a messages array (id, role, content, optional source, createdAt), an addMessage action, and a clear action. Both voice and text interactions will write to this same store. Persist to AsyncStorage so conversation survives app restart.
