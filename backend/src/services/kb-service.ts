import { Prisma } from "@prisma/client"
import prisma from "../db/client"
import { APPROVED_TAGS } from "../constants/tags"
import {
  EMBEDDING_SIMILARITY_THRESHOLD,
  KB_RAG_TOP_K,
} from "../constants/thresholds"
import { generate_embedding } from "./embedding-service"
import type { TKBEntry, TKBSearchResult } from "../types/kb-types"
import { create_logger } from "./logger-service"

const log = create_logger("kb-service")

function parse_tags(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

type TSearchRow = {
  id: string
  title: string
  content: string
  tags: string
  source: string
  ticket_id: string | null
  created_at: Date
  similarity: number
}

function entry_from_search_row(row: TSearchRow): TKBEntry {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: parse_tags(row.tags),
    source: row.source as TKBEntry["source"],
    ticket_id: row.ticket_id ?? undefined,
    created_at: row.created_at,
  }
}

function entry_from_prisma_row(row: {
  id: string
  title: string
  content: string
  tags: string
  source: string
  ticket_id: string | null
  created_at: Date
}): TKBEntry {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: parse_tags(row.tags),
    source: row.source as TKBEntry["source"],
    ticket_id: row.ticket_id ?? undefined,
    created_at: row.created_at,
  }
}

export async function search_kb(
  query: string,
  tags: string[]
): Promise<TKBSearchResult[]> {
  const query_embedding = await generate_embedding(query)
  const embedding_str = `[${query_embedding.join(",")}]`
  console.log(JSON.stringify(embedding_str))

  const valid_tags = tags.filter((t) =>
    (APPROVED_TAGS as readonly string[]).includes(t)
  )

  // Postgres JSON-array tag overlap check, applied in SQL so we don't
  // throw away vector neighbours that didn't make the top-K window.
  const tag_filter =
    valid_tags.length > 0
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(k.tags::jsonb) AS t(tag)
          WHERE t.tag IN (${Prisma.join(valid_tags)})
        )`
      : Prisma.empty

  const rows = await prisma.$queryRaw<TSearchRow[]>`
    SELECT
      k.id, k.title, k.content, k.tags, k.source, k.ticket_id, k.created_at,
      1 - (k.embedding <=> ${embedding_str}::vector) AS similarity
    FROM "KbEntry" k
    WHERE k.embedding IS NOT NULL
      ${tag_filter}
      AND 1 - (k.embedding <=> ${embedding_str}::vector) > ${EMBEDDING_SIMILARITY_THRESHOLD}
    ORDER BY similarity DESC
    LIMIT ${KB_RAG_TOP_K}
  `

  // Fallback: if tag-filtered search returned nothing (the LLM may have
  // chosen tags that don't match anything), retry without the tag filter.
  let final_rows = rows
  console.log(JSON.stringify(final_rows))
  if (rows.length === 0 && valid_tags.length > 0) {
    final_rows = await prisma.$queryRaw<TSearchRow[]>`
      SELECT
        k.id, k.title, k.content, k.tags, k.source, k.ticket_id, k.created_at,
        1 - (k.embedding <=> ${embedding_str}::vector) AS similarity
      FROM "KbEntry" k
      WHERE k.embedding IS NOT NULL
        AND 1 - (k.embedding <=> ${embedding_str}::vector) > ${EMBEDDING_SIMILARITY_THRESHOLD}
      ORDER BY similarity DESC
      LIMIT ${KB_RAG_TOP_K}
    `
  }

  log.info(
    `RAG: ${final_rows.length} hits${valid_tags.length ? ` (tags=${valid_tags.join(",")})` : ""} top_sim=${final_rows[0]?.similarity?.toFixed(3) ?? "n/a"}`
  )

  return final_rows.map((r) => ({
    entry: entry_from_search_row(r),
    raw_score: Math.round(r.similarity * 100),
    confidence: r.similarity,
  }))
}

export async function list_kb_entries(): Promise<TKBEntry[]> {
  const rows = await prisma.kbEntry.findMany({
    orderBy: { created_at: "desc" },
  })
  return rows.map(entry_from_prisma_row)
}

export async function create_kb_entry(
  data: Omit<TKBEntry, "id" | "created_at">
): Promise<TKBEntry> {
  const text_for_embed = `${data.title}\n${data.content}`
  const embedding = await generate_embedding(text_for_embed)
  const embedding_str = `[${embedding.join(",")}]`
  const id = crypto.randomUUID()

  await prisma.$executeRaw`
    INSERT INTO "KbEntry" (id, title, content, tags, embedding, source, ticket_id, created_at, updated_at)
    VALUES (
      ${id}, ${data.title}, ${data.content},
      ${JSON.stringify(data.tags)}, ${embedding_str}::vector,
      ${data.source}, ${data.ticket_id ?? null}, NOW(), NOW()
    )
  `

  return {
    id,
    title: data.title,
    content: data.content,
    tags: data.tags,
    source: data.source,
    ticket_id: data.ticket_id,
    created_at: new Date(),
  }
}

export async function delete_kb_entry(id: string): Promise<void> {
  await prisma.kbEntry.delete({ where: { id } })
}
