# Phase 28 — Wire the voice orb to VAPI

Connect the VoiceOrb to the VAPI SDK: pressing the orb when idle starts a call (vapi.start with the assistant config), pressing it while active stops the call (vapi.stop). Map SDK events to orb states: call-start → connecting/listening, speech-start → speaking, speech-end → listening, call-end and error → idle. Surface errors to the user with friendly messages.
