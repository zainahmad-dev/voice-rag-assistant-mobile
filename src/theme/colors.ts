/**
 * Design system color tokens.
 *
 * Light palette: the approved mobile design system.
 * Dark palette: matches the web app exactly
 * (voice-rag-assistant/src/app/globals.css, [data-theme="dark"]).
 */

export type Palette = {
  /** App background */
  bg: string;
  /** Cards, sheets, raised surfaces */
  surface: string;
  /** Primary text */
  ink: string;
  /** Secondary / muted text */
  inkSoft: string;
  /** Borders, dividers, hairlines */
  line: string;
  /** Primary accent (buttons, active states) */
  moss: string;
  /** Soft accent background (badges, highlights) */
  mossTint: string;
  /** Secondary accent (warm highlights) */
  ochre: string;
  /** Soft secondary background */
  ochreTint: string;
  /** Errors, destructive actions */
  alert: string;
};

export const lightColors: Palette = {
  bg: "#F6F4EF",
  surface: "#FFFDF9",
  ink: "#1C1F1B",
  inkSoft: "#5B5A4F",
  line: "#DCD7C9",
  moss: "#35604F",
  mossTint: "#E4EDE8",
  ochre: "#C1832E",
  ochreTint: "#F5E9D6",
  alert: "#B23A2E",
};

export const darkColors: Palette = {
  bg: "#0D1817", // web --background
  surface: "#132422", // web --surface
  ink: "#F3EEE2", // web --foreground
  inkSoft: "#9CA39B", // web --foreground-muted
  line: "#243936", // web --border
  moss: "#4FB8B4", // web --accent
  mossTint: "#1D3634", // web --accent-subtle
  ochre: "#D9AE68", // web --secondary
  ochreTint: "#332A19", // web --secondary-subtle
  alert: "#D9756C", // web --danger
};

export const palettes = {
  light: lightColors,
  dark: darkColors,
} as const;

export type ThemeMode = keyof typeof palettes;
