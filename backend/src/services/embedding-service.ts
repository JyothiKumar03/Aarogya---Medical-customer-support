import { embed } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { ENV } from "../utils/env"
import { MAX_EMBED_INPUT_CHARS } from "../constants/thresholds"

export async function generate_embedding(text: string): Promise<number[]> {
  if (ENV.OPENAI_API_KEY === "not-set") {
    throw new Error("OPENAI_API_KEY required for embeddings")
  }

  if (text.length > MAX_EMBED_INPUT_CHARS) {
    throw new Error(
      `Embedding input too long: ${text.length} chars (max ${MAX_EMBED_INPUT_CHARS}).`
    )
  }

  const openai = createOpenAI({ apiKey: ENV.OPENAI_API_KEY })
  const model = openai.embedding("text-embedding-3-small", { dimensions: 256 })

  const { embedding } = await embed({
    model,
    value: text,
    maxRetries: 0,
  })

  return embedding
}
