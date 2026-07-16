# Phase 24 — Install VAPI native SDK and peer dependencies

Install the VAPI React Native SDK and its peer dependencies: npm install @vapi-ai/react-native @daily-co/react-native-daily-js @react-native-async-storage/async-storage react-native-background-timer react-native-get-random-values. Install the exact WebRTC version: npm install --save-exact @daily-co/react-native-webrtc@118.0.3-daily.4. These are critical for voice; version mismatches cause WebRTC failures.
