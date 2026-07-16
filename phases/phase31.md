# Phase 31 — Integrate AsyncStorage for persistence

Wire AsyncStorage to conversationStore: save messages after each addMessage action, load messages on app start. Also persist the theme mode (light/dark) toggle so it survives app restart. Use simple JSON serialization — no complex migrations needed.
