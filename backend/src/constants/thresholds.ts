export const KB_CONFIDENCE_THRESHOLD = 0.6

export const EMBEDDING_SIMILARITY_THRESHOLD = 0.3

export const WEB_CONFIDENCE_FLOOR = 0.5

export const KB_RAG_TOP_K = 5

// Hard cap on user messages per chat session. After this many, the
// chat endpoint rejects new sends and the client surfaces "start new chat".
// Mirrors MAX_USER_MESSAGES_PER_CHAT on the frontend keep them in sync.
export const MAX_USER_MESSAGES_PER_CHAT = 4

// Hard cap on characters in a single user chat message. Rejects oversized
// payloads before they hit the agent / model.
export const MAX_CHAT_MESSAGE_CHARS = 6_000

// Upper bound on characters passed to the embedding model in a single call.
// text-embedding-3-small accepts ~8k tokens (~32k chars). 10k keeps a
// safety margin and matches what a "KB-sized" article should ever be.
export const MAX_EMBED_INPUT_CHARS = 10_000
