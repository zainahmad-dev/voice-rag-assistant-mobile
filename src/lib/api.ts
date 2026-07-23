/**
 * Typed client for the deployed voice-rag-assistant backend.
 *
 * Verified against https://voice-rag-assistant-blush.vercel.app:
 *   GET    /api/documents        → DocumentRecord[]
 *   DELETE /api/documents/[id]   → 204
 *   POST   /api/upload           → two-step Supabase signed-URL flow
 *   POST   /api/query            → { answer, sources }
 */

import { BASE_URL } from "./constants";
import { CONFIG_MESSAGE, NETWORK_MESSAGE, statusHint, withHint } from "./errors";
import {
  buildUploadMetadata,
  uploadFileToSignedUrl,
  validateFile,
} from "./upload";

// ---------------------------------------------------------------------------
// Types — mirror the backend rows (documents table) and query response.
// ---------------------------------------------------------------------------

export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

/** A row from the backend `documents` table. */
export type DocumentRecord = {
  id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  status: DocumentStatus;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
};

/** A retrieved chunk returned alongside an answer by POST /api/query. */
export type Source = {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  similarity: number;
  document_name: string;
};

export type QueryResponse = {
  answer: string;
  sources: Source[];
};

/** Role of a single turn in the assistant conversation. */
export type ChatRole = "user" | "assistant";

/** A message in the assistant conversation (client-side model). */
export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  /** Optional formatted source line, e.g. "similarity 0.87". */
  source?: string;
  createdAt: number;
};

/** The subset of a picked file the upload flow needs (matches PickedFile). */
export type UploadFile = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Throws a human-readable Error for a non-2xx response, preferring the
 * backend's `{ error }` / `{ message }` body when present. `action` names the
 * operation for the fallback message (e.g. "Loading documents"). A next-step
 * hint for the status is appended so the message never dead-ends.
 */
async function assertOk(res: Response, action: string): Promise<void> {
  if (res.ok) return;

  let message = `${action} failed (${res.status}).`;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (typeof body.error === "string") message = body.error;
    else if (typeof body.message === "string") message = body.message;
  } catch {
    // Non-JSON error body — keep the status-based message.
  }
  throw new Error(withHint(message, statusHint(res.status)));
}

/**
 * `fetch` against the backend with the two failure modes that aren't HTTP
 * statuses handled up front: no configured base URL, and a request that never
 * reached the server. Both otherwise surface as an opaque TypeError.
 */
async function request(
  path: string,
  action: string,
  init?: RequestInit,
): Promise<Response> {
  if (!BASE_URL) throw new Error(CONFIG_MESSAGE);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch (err) {
    console.warn(`[api] ${action} — request failed`, err);
    throw new Error(NETWORK_MESSAGE);
  }

  await assertOk(res, action);
  return res;
}

/** Parses a JSON body, treating a malformed one as a server-side failure. */
async function readJson<T>(res: Response, action: string): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[api] ${action} — bad JSON`, err);
    throw new Error(
      `${action} failed: the server sent an unexpected response. Please try again in a moment.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** GET /api/documents — the full document library, newest first. */
export async function fetchDocuments(): Promise<DocumentRecord[]> {
  const action = "Loading documents";
  const res = await request("/api/documents", action);
  return readJson<DocumentRecord[]>(res, action);
}

/** DELETE /api/documents/[id] — remove a document and its chunks. */
export async function deleteDocument(id: string): Promise<void> {
  await request(
    `/api/documents/${encodeURIComponent(id)}`,
    "Deleting document",
    { method: "DELETE" },
  );
}

/** Step-1 response from POST /api/upload. */
type SignedUploadResponse = {
  document: DocumentRecord;
  signedUrl: string;
  token: string;
  path: string;
};

/**
 * Uploads a document using the backend's three-step flow — the same one the
 * web client runs (see the web app's UploadDropzone.tsx):
 *   1. POST /api/upload with the file metadata → a pending DocumentRecord plus
 *      a signed storage URL.
 *   2. PUT the file bytes directly to that signed URL.
 *   3. POST /api/ingest with the document id → extract, chunk, embed, index.
 *
 * Step 3 is not optional: nothing on the backend watches Storage, so a
 * document that skips it stays `pending` with zero chunks forever — visible in
 * both clients' libraries but invisible to every query. (Phase 32 found two
 * such rows from earlier mobile uploads, which is how this was caught.)
 *
 * Ingest is fired without awaiting, because it runs the whole pipeline inside
 * that one request (up to 60s for a large PDF). Awaiting would hold the upload
 * spinner for the duration; instead the pending row is returned right away and
 * the library's existing status polling reports indexing → ready. A failed
 * ingest still surfaces: the backend writes `status: failed` with an
 * `error_message`, which the document card renders.
 *
 * Validation and the RN-specific storage upload live in ./upload for
 * testability. Resolves to the pending DocumentRecord created in step 1.
 */
export async function uploadDocument(file: UploadFile): Promise<DocumentRecord> {
  const validation = validateFile(file);
  if (!validation.valid) throw new Error(validation.reason);

  const metadata = buildUploadMetadata(file);
  console.log("[upload] 1/5 POST /api/upload", {
    baseUrl: BASE_URL,
    ...metadata,
    uri: file.uri,
  });

  // Step 1 — reserve a document row and obtain a signed storage URL.
  const initRes = await request("/api/upload", "Starting upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  const { document, signedUrl } = await readJson<SignedUploadResponse>(
    initRes,
    "Starting upload",
  );

  console.log("[upload] 2/5 signed URL received", {
    documentId: document.id,
    status: document.status,
    signedUrl,
  });

  // Step 2 — upload the file bytes to Supabase Storage.
  await uploadFileToSignedUrl(signedUrl, file);

  // Step 3 — kick off indexing. Deliberately not awaited; see the note above.
  void startIngest(document.id);

  return document;
}

/**
 * POST /api/ingest — asks the backend to index an already-uploaded document.
 *
 * Never rejects: the caller doesn't await it, and an unhandled rejection would
 * be a red-box warning rather than something the user can act on. The document
 * row is the real status channel — the backend marks it `failed` with a reason
 * the library then shows.
 */
async function startIngest(documentId: string): Promise<void> {
  console.log("[upload] 5/5 POST /api/ingest", { documentId });
  try {
    await request("/api/ingest", "Indexing document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    });
    console.log("[upload] ingest complete", { documentId });
  } catch (err) {
    console.warn("[upload] ingest failed", { documentId }, err);
  }
}

/** POST /api/query — ask a question and get an answer with its sources. */
export async function askQuestion(question: string): Promise<QueryResponse> {
  const action = "Asking question";
  const res = await request("/api/query", action, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  return readJson<QueryResponse>(res, action);
}
