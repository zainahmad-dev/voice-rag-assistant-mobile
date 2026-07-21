import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Mic } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { fonts } from "../theme/typography";
import { spacing } from "../theme/spacing";

export type VoiceOrbState = "idle" | "connecting" | "listening" | "speaking";

type VoiceOrbProps = {
  /** Driven from outside (VAPI call lifecycle in a later phase). */
  state: VoiceOrbState;
  onPress?: () => void;
};

const ORB_SIZE = 72;

const STATUS_LABELS: Record<VoiceOrbState, string> = {
  idle: "Tap to speak",
  connecting: "Connecting…",
  listening: "Listening — ask about your documents",
  speaking: "Speaking…",
};

// One pulse cycle: the ring grows past the orb edge while fading out.
const PULSE_DURATION_MS: Partial<Record<VoiceOrbState, number>> = {
  listening: 1800,
  speaking: 900,
};

/**
 * Circular moss button with a status label underneath. While listening it
 * shows a slow pulsing moss ring; while speaking, a faster ochre one.
 */
export function VoiceOrb({ state, onPress }: VoiceOrbProps) {
  const { palette } = useTheme();

  // 0 → 1 over one pulse; drives both the ring's scale and its fade-out.
  const pulse = useRef(new Animated.Value(0)).current;
  const pulseDuration = PULSE_DURATION_MS[state];

  useEffect(() => {
    if (pulseDuration === undefined) {
      pulse.setValue(0);
      return;
    }
    pulse.setValue(0);
    // Animated.loop resets the value before each iteration, so the ring always
    // restarts small and opaque rather than reversing back in.
    const animation = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: pulseDuration,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      pulse.setValue(0);
    };
  }, [pulse, pulseDuration]);

  const ringStyle = useMemo(
    () => ({
      transform: [
        {
          scale: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.4],
          }),
        },
      ],
      opacity: pulse.interpolate({
        inputRange: [0, 1],
        outputRange: [0.7, 0],
      }),
    }),
    [pulse],
  );

  const ringColor = state === "speaking" ? palette.ochre : palette.moss;
  const showRing = pulseDuration !== undefined;

  return (
    <View style={styles.container}>
      <View style={styles.orbWrapper}>
        {showRing && (
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { borderColor: ringColor }, ringStyle]}
          />
        )}
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={STATUS_LABELS[state]}
          accessibilityState={{ busy: state === "connecting" }}
          style={({ pressed }) => [
            styles.orb,
            { backgroundColor: palette.moss, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {state === "connecting" ? (
            <ActivityIndicator color={palette.bubbleText} />
          ) : (
            <Mic color={palette.bubbleText} size={28} />
          )}
        </Pressable>
      </View>
      <Text style={[styles.label, { color: palette.inkSoft }]}>
        {STATUS_LABELS[state]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.sm,
  },
  orbWrapper: {
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 2,
  },
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.body.medium,
    fontSize: 13,
    textAlign: "center",
  },
});
