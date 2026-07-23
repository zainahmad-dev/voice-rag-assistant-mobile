/**
 * VAPI voice client and the inline assistant configuration.
 *
 * The assistant is defined here rather than in the VAPI dashboard so the whole
 * voice contract lives in version control. Its single tool, `answerQuestion`,
 * is served by the backend's already-deployed /api/vapi/webhook route, which
 * runs the same RAG pipeline the text flow uses (POST /api/query) — so spoken
 * answers are grounded in the user's documents, not the model's training data.
 *
 * This config mirrors the web app's src/lib/vapi/assistant.ts; the tool name,
 * parameter name and webhook URL must stay in sync with it, because both
 * clients call the same webhook.
 */

// Polyfills crypto.getRandomValues, which daily-js needs to generate call IDs.
// Must be imported before Vapi is constructed, so it stays at the top of the
// only module that constructs one.
import "react-native-get-random-values";

import Vapi from "@vapi-ai/react-native";
import type { CreateAssistantDTO } from "@vapi-ai/react-native/dist/api";

import { BASE_URL, VAPI_PUBLIC_KEY } from "./constants";

/**
 * The deployed backend. VAPI's cloud — not the phone — calls the tool webhook,
 * so the URL has to be publicly reachable. When EXPO_PUBLIC_API_URL points at
 * a local/LAN backend (common while working on the API), fall back to the
 * deployed host instead of handing VAPI an address it cannot resolve.
 */
const PUBLIC_BACKEND_URL = "https://voice-rag-assistant-blush.vercel.app";

const isPubliclyReachable = BASE_URL.startsWith("https://");

if (!isPubliclyReachable && process.env.NODE_ENV !== "production") {
  console.warn(
    `EXPO_PUBLIC_API_URL (${BASE_URL || "unset"}) is not a public https URL. ` +
      `VAPI's servers cannot reach it, so voice tool calls will use ` +
      `${PUBLIC_BACKEND_URL} instead.`,
  );
}

/** Where VAPI sends `tool-calls` webhooks for the answerQuestion tool. */
export const WEBHOOK_URL = `${
  isPubliclyReachable ? BASE_URL : PUBLIC_BACKEND_URL
}/api/vapi/webhook`;

const SYSTEM_PROMPT = `You are a voice assistant that helps users ask questions about their uploaded documents.

You have no knowledge of your own about the user's documents. For every question about the documents,
you must call the answerQuestion function tool to get a grounded answer — never answer from your own
training knowledge, and never guess. Only skip the tool for pure chit-chat (greetings, thanks, "are you
still there") that isn't actually a question about the documents.

When the tool returns, speak its answer back to the user. Do not add facts beyond what the tool
returned, and do not contradict it. Keep responses short and conversational, since they are read aloud.`;

/**
 * Inline assistant passed straight to `vapi.start()` (see phase 28).
 *
 * `async: false` on the tool matters: the assistant must wait for the webhook's
 * answer so it can speak it, rather than firing the call and moving on.
 */
export const assistantConfig: CreateAssistantDTO = {
  name: "Document Assistant",
  firstMessage: "Hi, ask me anything about your uploaded documents.",
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en",
  },
  voice: {
    // Use VAPI's built-in voice, matching the working web config
    // (voice-rag-assistant/src/lib/vapi/assistant.ts) exactly.
    //
    // This had drifted to a third-party PlayHT voice (provider: "playht",
    // voiceId: "jennifer", model: "PlayHT2.0-turbo"), which was the confirmed
    // cause of the "connects then ejects" symptom on mobile: VAPI brings up
    // the Daily transport first (the mic goes green), then initialises the
    // voice pipeline server-side — and the PlayHT voice failed to provision
    // for this account, so VAPI ejected the participant a moment later
    // (endedReason: pipeline-error-playht-voice-failed). The web app never hit
    // this because it uses the always-available built-in "vapi" provider.
    // Keep this in lockstep with the web config.
    provider: "vapi",
    voiceId: "Elliot",
  },
  model: {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    messages: [{ role: "system", content: SYSTEM_PROMPT }],
    tools: [
      {
        type: "function",
        async: false,
        server: { url: WEBHOOK_URL },
        function: {
          name: "answerQuestion",
          description:
            "Answers the user's question by searching their uploaded documents. Always call this instead of answering from your own knowledge.",
          parameters: {
            type: "object",
            properties: {
              question: {
                type: "string",
                description:
                  "The user's question, restated in full as a standalone question.",
              },
            },
            required: ["question"],
          },
        },
      },
    ],
  },
};

let client: Vapi | null = null;

/**
 * The app's single Vapi instance, created on first use.
 *
 * Construction is deferred because instantiating Vapi pulls in daily-js and
 * its native WebRTC module — work that should not happen at import time on
 * screens that never start a call. Callers hold onto the returned instance for
 * the lifetime of the app; its event listeners are managed by the caller
 * (phase 28).
 */
export function getVapiClient(): Vapi {
  if (!VAPI_PUBLIC_KEY) {
    throw new Error(
      "Voice is not configured. Set EXPO_PUBLIC_VAPI_PUBLIC_KEY and rebuild the app.",
    );
  }
  if (!client) {
    client = new Vapi(VAPI_PUBLIC_KEY);
  }
  return client;
}

/**
 * Drops the cached client so the next `getVapiClient()` builds a fresh one.
 *
 * Needed because the SDK's `start()` sets an internal `started` flag *before*
 * creating the web call, but its failure path only clears that flag when a
 * Daily call object already exists (`cleanup()` returns early when it does
 * not). So when a call fails early — bad key, no network, VAPI 4xx — the
 * instance is left permanently "started" and every later `start()` returns
 * null without doing anything. Throwing the instance away is the only fix
 * available from outside the SDK. Callers should reset after any failed start.
 */
export function resetVapiClient(): void {
  client = null;
}
