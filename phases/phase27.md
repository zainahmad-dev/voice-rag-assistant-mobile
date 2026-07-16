# Phase 27 — Create the VAPI client and assistant config

Create src/lib/vapi.ts: initialize the VAPI client with the public key (EXPO_PUBLIC_VAPI_PUBLIC_KEY from env), and define the inline assistant configuration — a system prompt that forces every question through an answerQuestion function tool, transcriber (Deepgram) and voice provider (PlayHT) settings, and the tool's server URL pointing at the existing deployed webhook https://voice-rag-assistant-blush.vercel.app/api/vapi/webhook. The webhook itself already exists and needs no changes.
