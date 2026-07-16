# Phase 21 — Build the voice orb component

Create src/components/VoiceOrb.tsx: a circular moss-green button with four states — idle, connecting, listening, speaking — where listening shows a slow pulsing moss ring (react-native-reanimated) and speaking a faster pulsing ochre ring. Show a status label under the orb ('Tap to speak', 'Connecting…', 'Listening — ask about your documents', 'Speaking…'). State comes in via a prop so it can be driven by VAPI later.
