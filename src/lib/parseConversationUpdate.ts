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
 * `conversation-update` resends the call's *entire* message history every time,
 * and a single spoken answer arrives as a run of consecutive `bot` segments
 * (VAPI commits one per phrase as the model streams). Appending a message per
 * new segment renders one bubble per chunk, so instead this re-derives the
 * whole turn list on every update and COALESCES each run of consecutive `bot`
 * segments into one assistant turn. The caller (useVapiCall) diffs the result
 * against what it has already stored, so the in-progress answer updates a
 * single bubble in place and only becomes a separate, finished message once a
 * new user turn starts (or the call ends).
 *
 * Mirrors the web app's src/lib/vapi/parseConversationUpdate.ts.
 */

import type { NewMessage } from "../store/conversationStore";

/** A `{ documentName, similarity }` entry from the webhook's tool result. */
type WebhookSource = {
  documentName?: unknown;
  similarity?: unknown;
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
 * Re-derives the full ordered turn list for the current call from the message
 * history VAPI resends on every `conversation-update`.
 *
 * A turn boundary is a `user` message: everything the assistant says between
 * two user turns is one bubble, so the consecutive `bot` segments of a single
 * streamed answer coalesce instead of becoming a bubble each.
 *
 * A tool-call *result* is identified by its `toolCallId` (the SDK types `role`
 * as a bare `string`, so it isn't a dependable literal), including results that
 * carry an `error` instead of a `result`: a failed lookup must overwrite any
 * earlier pending source. Its sources are held in `pendingSource` and attached
 * to the assistant turn the model speaks next, then reset at the next user turn
 * so they can't leak onto a later reply — such as chit-chat — that skipped the
 * tool. Tool *call* entries carry `toolCalls`, not `toolCallId`, so they're
 * ignored here.
 */
export function parseConversationUpdate(allMessages: unknown): NewMessage[] {
  if (!Array.isArray(allMessages)) return [];

  const turns: NewMessage[] = [];
  // The assistant turn currently being built. It's already pushed into `turns`,
  // so appending to its `content` grows the same turn rather than adding one —
  // that's what keeps a streamed answer in a single bubble. Reset to null at
  // each user turn so the next answer starts fresh.
  let openAssistant: NewMessage | null = null;
  let pendingSource: string | undefined;

  for (const entry of allMessages) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;

    if (typeof record.toolCallId === "string") {
      const metadata = record.metadata as { sources?: unknown } | undefined;
      pendingSource = formatSource(metadata?.sources);
      continue;
    }

    const content =
      typeof record.message === "string" ? record.message.trim() : "";
    if (!content) continue;

    if (record.role === "user") {
      // A user turn ends the assistant's turn and drops the pending source: it
      // belonged to the answer just spoken, not to whatever comes next.
      openAssistant = null;
      pendingSource = undefined;
      turns.push({ role: "user", content });
    } else if (record.role === "bot") {
      if (openAssistant) {
        // Same answer continuing: grow the one bubble.
        openAssistant.content = `${openAssistant.content} ${content}`;
      } else {
        openAssistant = { role: "assistant", content, source: pendingSource };
        turns.push(openAssistant);
        pendingSource = undefined;
      }
    }
  }

  return turns;
}
