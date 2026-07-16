/**
 * Design system typography tokens.
 *
 * Font roles match the web app (globals.css):
 *   display — Space Grotesk (headings, app title)
 *   body    — Inter (UI text, messages)
 *   mono    — JetBrains Mono (data: file sizes, timestamps, sources)
 *
 * In React Native every weight is a separate font family, so each role
 * exposes its loaded weights by name. These strings must match the keys
 * passed to useFonts() from the @expo-google-fonts packages.
 */

export const fonts = {
  display: {
    medium: "SpaceGrotesk_500Medium",
    semiBold: "SpaceGrotesk_600SemiBold",
    bold: "SpaceGrotesk_700Bold",
  },
  body: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semiBold: "Inter_600SemiBold",
  },
  mono: {
    regular: "JetBrainsMono_400Regular",
    medium: "JetBrainsMono_500Medium",
  },
} as const;

export type FontRole = keyof typeof fonts;
