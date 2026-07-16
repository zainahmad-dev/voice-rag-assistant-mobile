# Phase 15 — Create the API client

Create src/lib/api.ts with typed functions against the deployed backend: fetchDocuments() → GET /api/documents, deleteDocument(id) → DELETE /api/documents/[id], uploadDocument(file) → multipart POST /api/upload using FormData ({ uri, name, type }), askQuestion(question) → POST /api/query returning answer and sources. Include DocumentRecord and ChatMessage types. Create src/lib/constants.ts with BASE_URL = EXPO_PUBLIC_API_URL.
