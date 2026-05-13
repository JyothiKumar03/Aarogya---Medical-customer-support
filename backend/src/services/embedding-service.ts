import { embed } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { ENV } from "../utils/env"

export async function generate_embedding(text: string): Promise<number[]> {
  if (ENV.OPENAI_API_KEY === "not-set") {
    throw new Error("OPENAI_API_KEY required for embeddings")
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
