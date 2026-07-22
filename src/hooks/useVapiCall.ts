import { useCallback, useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";

import type { VoiceOrbState } from "../components/VoiceOrb";
import { extractNewTurns } from "../lib/parseConversationUpdate";
import { assistantConfig, getVapiClient, resetVapiClient } from "../lib/vapi";
import { useConversationStore } from "../store/conversationStore";

type UseVapiCallResult = {
  /** Drives the orb: idle → connecting → listening ⇄ speaking. */
  state: VoiceOrbState;
  /** Last user-facing failure, or null. */
  error: string | null;
  /** Starts a call when idle, stops it otherwise. */
  toggleCall: () => void;
  dismissError: () => void;
};

const MIC_PERMISSION_MESSAGE =
  "Microphone access is off. Enable it for this app in Settings, then tap the orb again.";
const NETWORK_MESSAGE =
  "Couldn't reach the voice service. Check your connection and try again.";
const GENERIC_MESSAGE = "The voice call ran into a problem. Please try again.";

/** Pulls the most useful string out of the many error shapes VAPI can throw. */
function readMessage(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return null;

  const record = error as Record<string, unknown>;

  // The SDK wraps stage failures as { type, stage, error }, and its generated
  // API client throws the Response with the parsed body on `error`.
  const nested = record.error;
  if (nested && nested !== error) {
    const fromNested = readMessage(nested);
    if (fromNested) return fromNested;
  }

  const message = record.message;
  // VAPI's 400s return `message` as an array of validation strings.
  if (Array.isArray(message)) return message.filter(Boolean).join(" ");
  if (typeof message === "string") return message;

  if (typeof record.type === "string") return record.type;
  return null;
}

function toFriendlyMessage(error: unknown): string {
  const status =
    error && typeof error === "object"
      ? (error as { status?: unknown }).status
      : undefined;
  if (status === 401 || status === 403) {
    return "Voice isn't configured correctly (the VAPI key was rejected).";
  }

  const raw = readMessage(error);
  if (!raw) return GENERIC_MESSAGE;

  // Mic denial reaches us wrapped in Daily's join error rather than as a bare
  // permission error, so match on the text as well as the pre-flight check.
  if (/permission|not allowed|securityerror|notallowed/i.test(raw)) {
    return MIC_PERMISSION_MESSAGE;
  }
  if (/network|fetch|timeout|econn|offline/i.test(raw)) {
    return NETWORK_MESSAGE;
  }
  return raw;
}

/**
 * Asks for RECORD_AUDIO on Android before the call starts.
 *
 * react-native-webrtc requests it on its own during `getUserMedia`, but by then
 * a denial surfaces as an opaque Daily join failure. Asking up front lets us
 * fail with a message that tells the user what to do. iOS has no equivalent
 * pre-flight API — its prompt comes from the native audio session — so denial
 * there is caught by the error mapping above instead.
 */
async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Owns the VAPI client and maps its call lifecycle onto the orb's four states.
 *
 * The state comes from VAPI's own events rather than from "did we call start",
 * so the orb reflects what the call is actually doing: `call-start` (VAPI is
 * connected and listening) → "listening", `speech-start`/`speech-end` (the
 * assistant's audio level crossing a threshold) toggle "speaking", and
 * `call-end`/`error` return to "idle". The gap between the tap and
 * `call-start` is "connecting".
 *
 * The client is built on first toggle, so the native WebRTC stack is only
 * loaded once the user actually asks for voice.
 */
export function useVapiCall(): UseVapiCallResult {
  const [state, setState] = useState<VoiceOrbState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Guards the async gap inside start(): a second tap must not open a second
  // call, and a stop requested mid-connect has to be honoured once we land.
  const startingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  // Lets the unmount cleanup stop a live call without depending on `state`.
  const activeRef = useRef(false);

  // Voice turns land in the same store the typed flow writes to, so the two
  // interleave in one history and persist to AsyncStorage together.
  const addMessage = useConversationStore((store) => store.addMessage);
  // How much of the resent conversation history we've already stored, and the
  // retrieval line waiting to be attached to the next spoken answer.
  const processedCountRef = useRef(0);
  const pendingSourceRef = useRef<string | undefined>(undefined);

  const getClient = useCallback(() => {
    const vapi = getVapiClient();

    // getVapiClient caches, so re-attaching on every call would stack
    // duplicate listeners. A fresh instance has none, so clearing first keeps
    // exactly one set regardless of which case we're in.
    vapi.removeAllListeners();

    vapi.on("call-start", () => {
      activeRef.current = true;
      // Each call starts its own conversation history, so the cursor restarts
      // from zero while the store keeps everything from previous calls.
      processedCountRef.current = 0;
      pendingSourceRef.current = undefined;
      setError(null);
      setState("listening");
    });
    vapi.on("speech-start", () => setState("speaking"));
    vapi.on("speech-end", () => setState("listening"));
    vapi.on("call-end", () => {
      activeRef.current = false;
      setState("idle");
    });
    vapi.on("message", (message: unknown) => {
      const record = message as { type?: unknown; messages?: unknown } | null;
      if (!record || record.type !== "conversation-update") return;

      const { turns, nextIndex, pendingSource } = extractNewTurns(
        record.messages,
        processedCountRef.current,
        pendingSourceRef.current,
      );
      processedCountRef.current = nextIndex;
      pendingSourceRef.current = pendingSource;
      turns.forEach(addMessage);
    });
    vapi.on("error", (callError: unknown) => {
      console.warn("[vapi] call error", callError);
      activeRef.current = false;
      setError(toFriendlyMessage(callError));
      setState("idle");
    });

    return vapi;
  }, [addMessage]);

  const stopCall = useCallback(() => {
    activeRef.current = false;
    setState("idle");
    try {
      getVapiClient().stop();
    } catch (stopError) {
      // stop() before a call object exists is a no-op in the SDK; the state is
      // already back to idle either way, so there's nothing to tell the user.
      console.warn("[vapi] stop failed", stopError);
    }
  }, []);

  const startCall = useCallback(async () => {
    startingRef.current = true;
    stopRequestedRef.current = false;
    setError(null);
    setState("connecting");

    try {
      if (!(await ensureMicPermission())) {
        setError(MIC_PERMISSION_MESSAGE);
        setState("idle");
        return;
      }
      if (stopRequestedRef.current) {
        setState("idle");
        return;
      }

      const vapi = getClient();
      // The SDK swallows start failures and resolves to null instead of
      // rejecting, so a null result is a failure, not an idle no-op.
      const call = await vapi.start(assistantConfig);

      if (!call) {
        // The `error` listener has usually set a message already; only fill in
        // a generic one if it didn't, so we never fail silently.
        setError((current) => current ?? GENERIC_MESSAGE);
        setState("idle");
        resetVapiClient();
        return;
      }
      if (stopRequestedRef.current) {
        vapi.stop();
        activeRef.current = false;
        setState("idle");
        return;
      }
      // Otherwise `call-start` flips us to "listening" once VAPI is really
      // ready, rather than assuming it here.
    } catch (startError) {
      console.warn("[vapi] failed to start call", startError);
      setError(toFriendlyMessage(startError));
      setState("idle");
      resetVapiClient();
    } finally {
      startingRef.current = false;
      stopRequestedRef.current = false;
    }
  }, [getClient]);

  const toggleCall = useCallback(() => {
    if (startingRef.current) {
      // Mid-connect: remember the cancel and let startCall unwind it, since
      // there may not be a call object to stop yet.
      stopRequestedRef.current = true;
      return;
    }
    if (state === "idle") {
      void startCall();
    } else {
      stopCall();
    }
  }, [state, startCall, stopCall]);

  // Leaving the screen (or a reload in dev) must not leave a call running and
  // billing in the background.
  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      if (activeRef.current) {
        try {
          getVapiClient().stop();
        } catch {
          // Nothing to stop, and the component is going away regardless.
        }
      }
    };
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return { state, error, toggleCall, dismissError };
}
