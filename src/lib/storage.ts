/**
 * Thin JSON wrapper over AsyncStorage, plus the registry of every key the app
 * writes.
 *
 * Reads and writes are best-effort by design: persistence is a convenience
 * here (a transcript, a theme choice), never the source of truth, so a failed
 * or corrupt read logs and falls back to the default rather than throwing into
 * a render path.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

/** Every AsyncStorage key in the app, in one place. */
export const STORAGE_KEYS = {
  /** zustand-persist bucket for the shared conversation transcript. */
  conversation: "conversation",
  /** The user's manual light/dark override, absent while following system. */
  themeMode: "theme-mode",
} as const;

/**
 * Reads and parses a key. Returns null when it's unset, unparseable, or
 * rejected by `isValid` — a stale shape from an older build shouldn't be
 * handed to the app as if it were current.
 */
export async function loadJson<T>(
  key: string,
  isValid: (value: unknown) => value is T,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValid(parsed)) {
      console.warn(`[storage] ${key} held an unexpected value — ignoring it`);
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn(`[storage] failed to read ${key}`, err);
    return null;
  }
}

/** Serializes and writes a key. Resolves either way; failures only log. */
export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[storage] failed to write ${key}`, err);
  }
}
