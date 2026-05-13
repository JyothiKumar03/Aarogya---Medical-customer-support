import { z } from "zod"
import type { TMessage } from "../types/agent-types"
import { generate_object_with_fallback, build_providers } from "./ai-service"
import { SUMMARY_SYSTEM_PROMPT } from "../constants/prompts"
import { APPROVED_TAGS } from "../constants/tags"

const summary_schema = z.object({
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
})

export type TResolutionSummary = {
  title: string
  content: string
  tags: string[]
}

export async function generate_resolution_summary(
  conversation: TMessage[],
  resolution_notes: string
): Promise<TResolutionSummary> {
  const conversation_text = conversation
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")

  const prompt = `Conversation:\n${conversation_text}\n\nResolution notes:\n${resolution_notes}`

  const providers = build_providers()

  const result = await generate_object_with_fallback(
    providers,
    summary_schema,
    [{ role: "user", content: prompt }],
    SUMMARY_SYSTEM_PROMPT,
    { max_tokens: 500, temperature: 0.3 }
  )

  const valid_tags = result.tags.filter((t) =>
    (APPROVED_TAGS as readonly string[]).includes(t)
  )

  return {
    title: result.title,
    content: result.content,
    tags: valid_tags.length > 0 ? valid_tags : ["policy"],
  }
}
