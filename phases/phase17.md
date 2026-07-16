# Phase 17 — Wire the upload and document list flow

Connect UproadButton to the real API: on pick, call uploadDocument from api.ts, show the uploading state, refetch the document list on success, and show an Alert with a clear message on failure. Add status polling: while any document has status 'processing', refetch every 3 seconds; stop polling once all are 'ready' or 'failed'.
