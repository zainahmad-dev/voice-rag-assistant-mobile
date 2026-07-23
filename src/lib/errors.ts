/**
 * Shared mapping from thrown errors to user-facing messages.
 *
 * Every message here answers two questions: what happened, and what to do
 * next. The raw errors answer neither — `fetch` rejects with "Network request
 * failed" and a failed request is just a status code — so screens should route
 * everything they catch through `describeError` before showing it.
 */

/** Any request that never reached the server (airplane mode, DNS, timeout). */
export const NETWORK_MESSAGE =
  "Couldn't reach the server. Check your internet connection and try again.";

/** EXPO_PUBLIC_API_URL is unset, so there is nothing to call. */
export const CONFIG_MESSAGE =
  "The app isn't connected to a server yet. Set EXPO_PUBLIC_API_URL in .env and restart the app.";

/**
 * True when the failure happened below HTTP — a rejected `fetch`/`uploadAsync`
 * rather than a response. React Native surfaces these as a TypeError whose
 * message varies by platform, so the shapes are matched on text.
 */
export function isNetworkError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /network request failed|failed to fetch|network error|timed? ?out|econn|unable to resolve host|connection abort|internet connection/i.test(
    message,
  );
}

/**
 * Turns an unknown thrown value into a sentence worth showing. `fallback`
 * should already include a next step, since it is used when the error carries
 * no message of its own.
 */
export function describeError(error: unknown, fallback: string): string {
  if (isNetworkError(error)) return NETWORK_MESSAGE;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}

/** What the user can actually do about a given HTTP status. */
export function statusHint(status: number): string {
  if (status === 401 || status === 403) {
    return "The server rejected the request — check the app's API configuration.";
  }
  if (status === 404) {
    return "It isn't on the server anymore — pull down to refresh the list.";
  }
  if (status === 413) return "Try a smaller file.";
  if (status === 429) {
    return "Too many requests just now — wait a moment and try again.";
  }
  if (status >= 500) {
    return "The server had a problem — please try again in a moment.";
  }
  return "Please try again.";
}

/** Messages that already tell the user what to do next need no hint added. */
const HAS_NEXT_STEP =
  /try again|check your|please (?:choose|pick|wait|set)|enable it|rebuild the app|set expo_public/i;

/**
 * Appends a next-step hint to a message, skipping it when the message already
 * says what to do (the backend's own errors, and our config errors, often do).
 */
export function withHint(message: string, hint: string): string {
  const trimmed = message.trim();
  if (!hint || HAS_NEXT_STEP.test(trimmed)) return trimmed;
  return `${trimmed.replace(/[.\s]+$/, "")}. ${hint}`;
}
