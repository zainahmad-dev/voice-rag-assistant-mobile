import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import { loadJson, saveJson, STORAGE_KEYS } from "../lib/storage";
import { palettes, type Palette, type ThemeMode } from "./colors";

type ThemeContextValue = {
  /** Colors for the active mode */
  palette: Palette;
  /** Active mode: "light" | "dark" */
  mode: ThemeMode;
  /** Switch between light and dark (sets a manual override) */
  toggle: () => void;
  /** Set the mode explicitly; persists the choice like `toggle` does */
  setMode: (mode: ThemeMode) => void;
  /** True once the stored choice has been read back from AsyncStorage */
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Follows the phone's scheme until the user toggles manually; while no
  // override is set, system scheme changes are picked up live.
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Only a *manual* choice is stored, so an absent key keeps meaning "follow
  // the system" — persisting the resolved mode would silently freeze the app
  // to whatever the scheme happened to be on first launch.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadJson(STORAGE_KEYS.themeMode, isThemeMode);
      if (cancelled) return;
      if (stored) setOverride(stored);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mode: ThemeMode =
    override ?? (systemScheme === "dark" ? "dark" : "light");

  const setMode = useCallback((next: ThemeMode) => {
    setOverride(next);
    void saveJson(STORAGE_KEYS.themeMode, next);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ palette: palettes[mode], mode, toggle, setMode, hydrated }),
    [mode, toggle, setMode, hydrated],
  );

  // Rendering before the stored choice is known would paint the system theme
  // first and then snap to the user's — one AsyncStorage read is cheaper than
  // that flash, and App already gates on font loading the same way.
  if (!hydrated) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }
  return ctx;
}
