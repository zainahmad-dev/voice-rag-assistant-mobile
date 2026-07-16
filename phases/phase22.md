# Phase 22 — Wire the text query flow

Connect the Assistant screen's text input to the real API: on send, add the user message to conversationStore, show a 'Searching your documents…' loading indicator (create src/components/Loading.tsx), call askQuestion from api.ts, then add the assistant's answer (with the top source's similarity) to the store. Handle errors by adding a friendly assistant-style error message. Auto-scroll to the newest message using FlatList's scrollToEnd.
