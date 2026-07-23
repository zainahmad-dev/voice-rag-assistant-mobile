import { useCallback, useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform } from "react-native";

import type { VoiceOrbState } from "../components/VoiceOrb";
import { NETWORK_MESSAGE, isNetworkError, withHint } from "../lib/errors";
import { parseConversationUpdate } from "../lib/parseConversationUpdate";
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
const GENERIC_MESSAGE =
  "The voice call ran into a problem. Tap the orb to try again.";

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
    return "Voice isn't configured correctly — the VAPI key was rejected. Check EXPO_PUBLIC_VAPI_PUBLIC_KEY and rebuild the app.";
  }

  const raw = readMessage(error);
  if (!raw) return GENERIC_MESSAGE;

  // Mic denial reaches us wrapped in Daily's join error rather than as a bare
  // permission error, so match on the text as well as the pre-flight check.
  if (/permission|not allowed|securityerror|notallowed/i.test(raw)) {
    return MIC_PERMISSION_MESSAGE;
  }
  if (isNetworkError(raw) || /network|fetch|offline/i.test(raw)) {
    return NETWORK_MESSAGE;
  }
  // A raw SDK string rarely says what to do, so pair it with the next step.
  return withHint(raw, "Tap the orb to try again.");
}

/**
 * Serializes any value for logging, surviving the two things that make a raw
 * `console.warn(err)` useless in Metro: circular references (Daily/VAPI errors
 * are full of them) and `Error` instances (which stringify to `{}`). Used to
 * dump the exact reason VAPI/Daily ejected a call.
 */
function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_key, val) => {
        if (val instanceof Error) {
          return { name: val.name, message: val.message, stack: val.stack };
        }
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) return "[Circular]";
          seen.add(val);
        }
        return val;
      },
      2,
    );
  } catch (err) {
    return `<unserializable: ${String(err)}>`;
  }
}

/**
 * Logs a VAPI/Daily error with every field an ejection tends to hide behind.
 *
 * Daily ejections surface as `{ action: "error", errorMsg, error }`, VAPI wraps
 * stage failures as `{ type, stage, error }`, and its API client throws the
 * Response with the body on `error` — so the useful string is nested and gets
 * collapsed to "[object Object]" by a plain log. This pulls the likely fields
 * up front and appends the full serialized payload after them.
 */
function logVapiError(context: string, error: unknown): void {
  const record = (
    error && typeof error === "object" ? error : {}
  ) as Record<string, unknown>;
  const nested = (
    record.error && typeof record.error === "object" ? record.error : {}
  ) as Record<string, unknown>;

  console.warn(
    `${context}` +
      `\n  action/type: ${String(record.action ?? record.type ?? nested.type ?? "—")}` +
      `\n  stage:       ${String(record.stage ?? nested.stage ?? "—")}` +
      `\n  errorMsg:    ${String(record.errorMsg ?? record.msg ?? nested.errorMsg ?? "—")}` +
      `\n  message:     ${String(record.message ?? nested.message ?? "—")}` +
      `\n  endedReason: ${String(record.endedReason ?? nested.endedReason ?? "—")}` +
      `\n  full:        ${safeStringify(error)}`,
  );
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
  if (Platform.OS !== "android") {
    // iOS has no pre-flight permission API available to JS here; the native
    // audio session prompts on first mic use, and a denial comes back through
    // the error mapping above. So we can only confirm the grant on Android —
    // on iOS, watch the logs for a permission/NotAllowed error after start().
    console.log(
      "[vapi] mic permission: iOS — relying on the native audio session prompt (cannot pre-confirm from JS)",
    );
    return true;
  }

  const RECORD_AUDIO = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;

  // check() reports the *actual* on-device grant state (a manifest entry alone
  // does not grant it), so this distinguishes "already granted" from "the OS
  // just prompted" and proves the mic is really available before the call.
  const alreadyGranted = await PermissionsAndroid.check(RECORD_AUDIO);
  console.log(
    `[vapi] mic permission (Android): already granted on device? ${alreadyGranted}`,
  );
  if (alreadyGranted) return true;

  const result = await PermissionsAndroid.request(RECORD_AUDIO);
  const granted = result === PermissionsAndroid.RESULTS.GRANTED;
  console.log(
    `[vapi] mic permission (Android): request result "${result}" (granted=${granted})`,
  );
  return granted;
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
  const updateMessage = useConversationStore((store) => store.updateMessage);
  // The store messages created for the current call, in order, each with the
  // content/source last written to it. `conversation-update` resends the whole
  // history every time and grows the in-progress answer, so we diff the newly
  // derived turns against this list — extending an existing bubble in place
  // instead of adding one per streamed chunk, and appending only genuinely new
  // turns (a fresh user question, or the first segment of the next answer).
  const liveTurnsRef = useRef<
    { id: string; content: string; source?: string }[]
  >([]);

  const getClient = useCallback(() => {
    const vapi = getVapiClient();

    // getVapiClient caches, so re-attaching on every call would stack
    // duplicate listeners. A fresh instance has none, so clearing first keeps
    // exactly one set regardless of which case we're in.
    vapi.removeAllListeners();

    vapi.on("call-start", () => {
      console.log("[vapi] call-start — connected and listening (mic live)");
      activeRef.current = true;
      // Each call tracks only its own turns; the store keeps everything from
      // previous calls, but nothing here should touch those earlier bubbles.
      liveTurnsRef.current = [];
      setError(null);
      setState("listening");
    });
    vapi.on("speech-start", () => setState("speaking"));
    vapi.on("speech-end", () => setState("listening"));

    // Staged startup telemetry (RN SDK ≥ 0.3). `call-start-progress` traces
    // each connection stage; `call-start-failed` fires with the exact stage
    // and error string when the call is rejected/ejected while connecting —
    // the single most useful signal for the "green mic then ejected" symptom.
    vapi.on("call-start-progress", (event) => {
      console.log(
        `[vapi] start-progress: stage=${event.stage} status=${event.status}` +
          (event.metadata ? ` metadata=${safeStringify(event.metadata)}` : ""),
      );
    });
    vapi.on("call-start-failed", (event) => {
      logVapiError("[vapi] call-start-failed", event);
    });

    vapi.on("call-end", () => {
      // The RN SDK's `call-end` carries no payload, so the *reason* a call
      // ended/ejected does not arrive here — it comes through `error` and the
      // `status-update`/`end-of-call-report` message (endedReason), both
      // logged below.
      console.log("[vapi] call-end");
      activeRef.current = false;
      setState("idle");
    });
    vapi.on("message", (message: unknown) => {
      const record = message as {
        type?: unknown;
        messages?: unknown;
        status?: unknown;
        endedReason?: unknown;
      } | null;
      if (!record || typeof record !== "object") return;

      // The definitive "why did the call end/eject" signal is VAPI's
      // status-update / end-of-call-report message, whose `endedReason` names
      // the exact fault (e.g. a "pipeline-error-…-voice-failed"). Surface it —
      // it does not come through the `error` event.
      if (
        record.type === "status-update" ||
        record.type === "end-of-call-report" ||
        "endedReason" in record
      ) {
        console.warn(`[vapi] status message ${safeStringify(record)}`);
      }

      if (record.type !== "conversation-update") return;

      // Re-derive the whole call from the resent history, then reconcile it
      // against what we've already shown: grow the in-progress answer's bubble
      // in place, and append only turns we haven't rendered yet. Turns already
      // committed (finished user/assistant bubbles) never change, so matching
      // by position is safe — the only mutable turn is the last one, still
      // being spoken.
      const derived = parseConversationUpdate(record.messages);
      const live = liveTurnsRef.current;
      for (let i = 0; i < derived.length; i += 1) {
        const turn = derived[i];
        const existing = live[i];
        if (!existing) {
          const id = addMessage(turn);
          live.push({ id, content: turn.content, source: turn.source });
        } else if (
          existing.content !== turn.content ||
          existing.source !== turn.source
        ) {
          updateMessage(existing.id, {
            content: turn.content,
            source: turn.source,
          });
          existing.content = turn.content;
          existing.source = turn.source;
        }
      }
    });
    vapi.on("error", (callError: unknown) => {
      logVapiError("[vapi] call error", callError);
      activeRef.current = false;
      setError(toFriendlyMessage(callError));
      setState("idle");
    });

    return vapi;
  }, [addMessage, updateMessage]);

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
      console.log("[vapi] mic OK — calling vapi.start()");
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
