# Phase 25 — Configure native microphone permissions

Update app.json with platform-specific permissions: iOS infoPlist NSMicrophoneUsageDescription = 'Ask questions about your documents by voice', Android permissions include RECORD_AUDIO and MODIFY_AUDIO_SETTINGS. Explain why these are required and what happens without them (app crashes or silently fails on first voice use).
