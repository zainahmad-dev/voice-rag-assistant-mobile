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
import { NETWORK_MESSAGE, isNetworkError, statusHint, withHint } from "./errors";

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
  if (!file.uri) {
    return {
      valid: false,
      reason:
        "That file couldn't be read from your device. Try picking it again, or copy it into your Files app first.",
    };
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.mimeType)) {
    return {
      valid: false,
      reason: "Unsupported file type. Please choose a PDF, DOCX, or TXT file.",
    };
  }
  if (file.size === 0) {
    return {
      valid: false,
      reason: "That file is empty. Choose a file that has some text in it.",
    };
  }
  if (file.size != null && file.size > MAX_FILE_SIZE) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      reason: `File is too large (${mb} MB). The maximum size is ${MAX_FILE_SIZE_MB} MB — try a smaller file, or split it into parts.`,
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
  console.log("[upload] 3/5 PUT to storage", {
    uri: file.uri,
    contentType: file.mimeType,
    fileSize: file.size,
  });

  let res;
  try {
    res = await uploadAsync(signedUrl, file.uri, {
      httpMethod: "PUT",
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: { "Content-Type": file.mimeType },
    });
  } catch (err) {
    console.warn("[upload] PUT threw", err);
    // A rejection here is either the network dropping mid-upload or the local
    // file no longer being readable — the picked copy can be evicted from the
    // cache directory. Both need a different next step than a bad status.
    if (isNetworkError(err)) throw new Error(NETWORK_MESSAGE);
    throw new Error(
      "Couldn't read that file from your device. Pick it again and retry the upload.",
    );
  }

  const ok = res.status >= 200 && res.status < 300;
  console.log("[upload] 4/5 PUT complete", {
    status: res.status,
    ok,
    body: res.body,
  });

  if (!ok) {
    throw new Error(
      withHint(`Uploading the file failed (${res.status})`, storageHint(res.status)),
    );
  }
}

/**
 * Next steps for a failed storage PUT. Storage statuses mean different things
 * than the backend's do — a 403/404 here is an expired or already-used signed
 * URL, not a missing document — so `statusHint` doesn't apply.
 */
function storageHint(status: number): string {
  if (status === 400 || status === 403 || status === 404) {
    return "The upload link expired before the file finished. Please upload it again.";
  }
  if (status === 413) return `Try a file under ${MAX_FILE_SIZE_MB} MB.`;
  return statusHint(status);
}
