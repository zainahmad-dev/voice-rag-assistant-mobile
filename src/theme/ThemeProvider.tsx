import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import { palettes, type Palette, type ThemeMode } from "./colors";

type ThemeContextValue = {
  /** Colors for the active mode */
  palette: Palette;
  /** Active mode: "light" | "dark" */
  mode: ThemeMode;
  /** Switch between light and dark (sets a manual override) */
  toggle: () => void;
  /** Set the mode explicitly (used when restoring a persisted choice) */
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Follows the phone's scheme until the user toggles manually; while no
  // override is set, system scheme changes are picked up live.
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);

  const mode: ThemeMode =
    override ?? (systemScheme === "dark" ? "dark" : "light");

  const toggle = useCallback(() => {
    setOverride(mode === "dark" ? "light" : "dark");
  }, [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ palette: palettes[mode], mode, toggle, setMode: setOverride }),
    [mode, toggle],
  );

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
