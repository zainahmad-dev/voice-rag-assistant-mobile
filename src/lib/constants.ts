/**
 * App-wide constants.
 *
 * EXPO_PUBLIC_* variables are inlined into the JS bundle at build time (see
 * .env.example) and are readable by anyone with the app — never put secrets
 * here.
 */

/** Base URL of the deployed voice-rag-assistant backend. */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

if (!BASE_URL && process.env.NODE_ENV !== "production") {
  console.warn(
    "EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and restart " +
      "the dev server — API requests will fail until it is configured.",
  );
}

/**
 * VAPI public (client) key. This one is designed to ship in a client bundle —
 * it can only start calls, not read or modify the account — so it belongs in
 * an EXPO_PUBLIC_ variable. The private key must never appear here.
 */
export const VAPI_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPI_PUBLIC_KEY ?? "";

if (!VAPI_PUBLIC_KEY && process.env.NODE_ENV !== "production") {
  console.warn(
    "EXPO_PUBLIC_VAPI_PUBLIC_KEY is not set. Copy .env.example to .env and " +
      "restart the dev server — the voice assistant will fail to start.",
  );
}
