/**
 * Turns VAPI's `conversation-update` payloads into conversation-store messages.
 *
 * Why this event and not `transcript`: `transcript` fires repeatedly with
 * partial, still-changing text, and it carries no tool metadata.
 * `conversation-update` is committed history, and it's the only place the
 * `metadata.sources` our webhook returns (see the backend's
 * /api/vapi/webhook route) reaches the client — so it's the only way a spoken
 * answer can show the same retrieval line a typed one does.
 *
 * Mirrors the web app's src/lib/vapi/parseConversationUpdate.ts.
 */

import type { NewMessage } from "../store/conversationStore";

/** A `{ documentName, similarity }` entry from the webhook's tool result. */
type WebhookSource = {
  documentName?: unknown;
  similarity?: unknown;
};

export type ExtractResult = {
  /** Turns added since `startIndex`, ready to hand to `addMessage`. */
  turns: NewMessage[];
  /** Pass back as the next call's `startIndex`. */
  nextIndex: number;
  /** Pass back as the next call's `initialPendingSource`. */
  pendingSource: string | undefined;
};

/**
 * Formats a retrieval line identical to the typed flow's (AssistantScreen
 * builds "similarity 0.87" from POST /api/query), so voice and text bubbles
 * read the same in one list.
 */
function formatSource(sources: unknown): string | undefined {
  if (!Array.isArray(sources) || sources.length === 0) return undefined;
  const top = sources[0] as WebhookSource | null;
  const similarity = top?.similarity;
  if (typeof similarity !== "number" || !Number.isFinite(similarity)) {
    return undefined;
  }
  return `similarity ${similarity.toFixed(2)}`;
}

/**
 * `conversation-update` resends the call's *entire* message history every
 * time, so this converts only the entries after `startIndex`.
 *
 * A tool-call result is identified by its `toolCallId`/`result` fields rather
 * than by `role` — the SDK types that as a bare `string` and the live value
 * isn't a dependable literal. Its sources are held in `pendingSource` and
 * attached to the next bot turn (the model speaks the answer immediately
 * after the tool returns), then cleared so they can't leak onto an unrelated
 * later reply such as chit-chat that skipped the tool.
 */
export function extractNewTurns(
  allMessages: unknown,
  startIndex: number,
  initialPendingSource: string | undefined,
): ExtractResult {
  if (!Array.isArray(allMessages)) {
    return { turns: [], nextIndex: startIndex, pendingSource: initialPendingSource };
  }

  const turns: NewMessage[] = [];
  let pendingSource = initialPendingSource;

  for (const entry of allMessages.slice(startIndex)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;

    // Keyed on toolCallId alone, including results that carry an `error`
    // instead of a `result`: a failed lookup must overwrite any earlier
    // pending source rather than leave it to attach to the apology the model
    // speaks next. Tool *call* entries carry `toolCalls`, not `toolCallId`,
    // so they don't match here.
    if (typeof record.toolCallId === "string") {
      const metadata = record.metadata as { sources?: unknown } | undefined;
      pendingSource = formatSource(metadata?.sources);
      continue;
    }

    const content =
      typeof record.message === "string" ? record.message.trim() : "";
    if (!content) continue;

    if (record.role === "user") {
      turns.push({ role: "user", content });
    } else if (record.role === "bot") {
      turns.push({ role: "assistant", content, source: pendingSource });
      pendingSource = undefined;
    }
  }

  return {
    turns,
    // Never move the cursor backwards: a short or stale update must not make
    // us replay turns we've already stored.
    nextIndex: Math.max(startIndex, allMessages.length),
    pendingSource,
  };
}
