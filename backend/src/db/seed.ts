import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import prisma from "./client"
import { generate_embedding } from "../services/embedding-service"
import { create_logger } from "../services/logger-service"

const log = create_logger("seed")

const __dirname = dirname(fileURLToPath(import.meta.url))

type TSeedEntry = {
  id: string
  title: string
  content: string
  tags: string[]
  source: string
}

async function seed(): Promise<void> {
  const raw = readFileSync(resolve(__dirname, "../../data/kb.json"), "utf-8")
  const entries: TSeedEntry[] = JSON.parse(raw)

  let embedded = 0

  for (const entry of entries) {
    let embedding: number[] | null = null
    try {
      const text_for_embed = `${entry.title}\n${entry.content}`
      embedding = await generate_embedding(text_for_embed)
      embedded++
    } catch (err) {
      log.warn(
        `${entry.id}: embedding failed storing without embedding`,
        err
      )
    }

    if (embedding) {
      const embedding_str = `[${embedding.join(",")}]`
      await prisma.$executeRaw`
        INSERT INTO "KbEntry" (id, title, content, tags, embedding, source, created_at, updated_at)
        VALUES (
          ${entry.id}, ${entry.title}, ${entry.content},
          ${JSON.stringify(entry.tags)}, ${embedding_str}::vector,
          ${entry.source}, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          tags = EXCLUDED.tags,
          embedding = EXCLUDED.embedding,
          source = EXCLUDED.source,
          updated_at = NOW()
      `
    } else {
      await prisma.$executeRaw`
        INSERT INTO "KbEntry" (id, title, content, tags, source, created_at, updated_at)
        VALUES (${entry.id}, ${entry.title}, ${entry.content}, ${JSON.stringify(entry.tags)}, ${entry.source}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          tags = EXCLUDED.tags,
          source = EXCLUDED.source,
          updated_at = NOW()
      `
    }

    log.info(`✓ ${entry.id} ${entry.title.slice(0, 60)}`)
  }

  // Seed default SearchSettings if none exist
  const existing_settings = await prisma.searchSettings.findFirst()
  if (!existing_settings) {
    await prisma.searchSettings.create({
      data: {
        allowed_domains: JSON.stringify(["prudential.com"]),
        blocked_domains: JSON.stringify([]),
      },
    })
    log.info("✓ Default search settings seeded")
  }

  log.info(`Seeded ${entries.length} KB entries (${embedded} with embeddings).`)
  await prisma.$disconnect()
}

seed().catch((err) => {
  log.error("Seed failed", err)
  process.exit(1)
})
