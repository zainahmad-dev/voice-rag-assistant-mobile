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
 * operation for the fallback message (e.g. "Loading documents").
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
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** GET /api/documents — the full document library, newest first. */
export async function fetchDocuments(): Promise<DocumentRecord[]> {
  const res = await fetch(`${BASE_URL}/api/documents`);
  await assertOk(res, "Loading documents");
  return (await res.json()) as DocumentRecord[];
}

/** DELETE /api/documents/[id] — remove a document and its chunks. */
export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/documents/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  await assertOk(res, "Deleting document");
}

/** Step-1 response from POST /api/upload. */
type SignedUploadResponse = {
  document: DocumentRecord;
  signedUrl: string;
  token: string;
  path: string;
};

/**
 * Uploads a document using the backend's two-step Supabase flow:
 *   1. POST /api/upload with the file metadata → a pending DocumentRecord plus
 *      a signed storage URL.
 *   2. PUT the file bytes directly to that signed URL.
 * The backend then chunks/embeds asynchronously (status: pending → processing
 * → completed), so callers refetch/poll for the final state (phase 17).
 *
 * Validation and the RN-specific storage upload live in ./upload for
 * testability. Resolves to the pending DocumentRecord created in step 1.
 */
export async function uploadDocument(file: UploadFile): Promise<DocumentRecord> {
  const validation = validateFile(file);
  if (!validation.valid) throw new Error(validation.reason);

  const metadata = buildUploadMetadata(file);
  console.log("[upload] 1/4 POST /api/upload", {
    baseUrl: BASE_URL,
    ...metadata,
    uri: file.uri,
  });

  // Step 1 — reserve a document row and obtain a signed storage URL.
  const initRes = await fetch(`${BASE_URL}/api/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  await assertOk(initRes, "Starting upload");
  const { document, signedUrl } =
    (await initRes.json()) as SignedUploadResponse;

  console.log("[upload] 2/4 signed URL received", {
    documentId: document.id,
    status: document.status,
    signedUrl,
  });

  // Step 2 — upload the file bytes to Supabase Storage.
  await uploadFileToSignedUrl(signedUrl, file);

  return document;
}

/** POST /api/query — ask a question and get an answer with its sources. */
export async function askQuestion(question: string): Promise<QueryResponse> {
  const res = await fetch(`${BASE_URL}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  await assertOk(res, "Asking question");
  return (await res.json()) as QueryResponse;
}
