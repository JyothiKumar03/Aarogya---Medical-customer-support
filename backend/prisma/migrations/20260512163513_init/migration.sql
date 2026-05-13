-- Enable pgvector for 256-dim embeddings used by the KB RAG layer.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "KbEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "embedding" vector(256),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "ticket_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "kb_entry_id" TEXT,
    "search_result_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchResult" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "search_type" TEXT NOT NULL,
    "results_json" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "top_entry_id" TEXT,
    "web_source_url" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "query_summary" TEXT NOT NULL,
    "conversation_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution_notes" TEXT,
    "resolution_summary" TEXT,
    "added_to_kb" BOOLEAN NOT NULL DEFAULT false,
    "kb_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_kb_entry_id_fkey" FOREIGN KEY ("kb_entry_id") REFERENCES "KbEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_search_result_id_fkey" FOREIGN KEY ("search_result_id") REFERENCES "SearchResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchResult" ADD CONSTRAINT "SearchResult_top_entry_id_fkey" FOREIGN KEY ("top_entry_id") REFERENCES "KbEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_kb_entry_id_fkey" FOREIGN KEY ("kb_entry_id") REFERENCES "KbEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
