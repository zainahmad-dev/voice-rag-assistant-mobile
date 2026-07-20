/**
 * Upload helpers, kept separate from the network calls in api.ts for
 * testability.
 *
 * NOTE: phase 16 originally specified a multipart `formatFormData` helper, but
 * the deployed backend uses a two-step Supabase signed-URL flow (see api.ts),
 * 
 * so there is no multipart FormData. The React-Native-specific concern that
 * `formatFormData` addressed — getting a local `file://` URI's bytes onto the
 * wire — lives in `uploadFileToSignedUrl` below instead.
 */

import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";

import type { UploadFile } from "./api";

/** Max upload size accepted by the backend, in MB and bytes. */
export const MAX_FILE_SIZE_MB = 15;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

/** MIME types the backend can ingest (mirrors the picker filter). */
export const ACCEPTED_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Checks a picked file before uploading: accepted type and size ≤ 15MB. Size
 * can be undefined on some Android providers — when it is, the size check is
 * skipped rather than failing a possibly-valid file.
 */
export function validateFile(file: UploadFile): ValidationResult {
  if (!ACCEPTED_MIME_TYPES.includes(file.mimeType)) {
    return {
      valid: false,
      reason: "Unsupported file type. Please choose a PDF, DOCX, or TXT file.",
    };
  }
  if (file.size != null && file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      reason: `File is too large. The maximum size is ${MAX_FILE_SIZE_MB} MB.`,
    };
  }
  return { valid: true };
}

/** Body of the step-1 metadata request (POST /api/upload). */
export type UploadMetadata = {
  fileName: string;
  fileSize: number;
  fileType: string;
};

/** Builds the JSON metadata the backend needs to mint a signed upload URL. */
export function buildUploadMetadata(file: UploadFile): UploadMetadata {
  return {
    fileName: file.name,
    fileSize: file.size ?? 0,
    fileType: file.mimeType,
  };
}

/**
 * Uploads a local file's bytes to a Supabase Storage signed URL (step 2 of the
 * upload flow). Uses expo-file-system's `uploadAsync` with BINARY_CONTENT,
 * which streams the file straight from its local `file://`/`content://` URI.
 * The previous `fetch(uri).blob()` approach returned an empty body on-device,
 * so the PUT "succeeded" but left nothing in Storage. The signed URL is
 * Supabase's, not our backend, so a status-based error message is used rather
 * than the `{ error }` shape our API returns.
 */
export async function uploadFileToSignedUrl(
  signedUrl: string,
  file: UploadFile,
): Promise<void> {
  console.log("[upload] 3/4 PUT to storage", {
    uri: file.uri,
    contentType: file.mimeType,
    fileSize: file.size,
  });

  const res = await uploadAsync(signedUrl, file.uri, {
    httpMethod: "PUT",
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": file.mimeType },
  });

  const ok = res.status >= 200 && res.status < 300;
  console.log("[upload] 4/4 PUT complete", {
    status: res.status,
    ok,
    body: res.body,
  });

  if (!ok) {
    throw new Error(`Uploading file failed (${res.status}).`);
  }
}
