import { z } from "zod"
import { build_check_providers, generate_object_with_fallback } from "./ai-service"
import { SCORE_SYSTEM_PROMPT } from "../constants/prompts"
import { create_logger } from "./logger-service"
import type { TKBEntry } from "../types/kb-types"

const log = create_logger("score-service")

export type TScoreResult = {
  confidence: number
  best_entry_index: number
  reasoning: string
}

const score_schema = z.object({
  confidence: z.number().min(0).max(1),
best_entry_index: z.union([
  z.literal(-1),
  z.number().int().min(0)
]),
  reasoning: z.string().max(120),
})

export async function score_kb_results(
  user_query: string,
  tool_query: string,
  entries: TKBEntry[]
): Promise<TScoreResult> {
  if (entries.length === 0) {
    return { confidence: 0, best_entry_index: 0, reasoning: "no entries" }
  }

  const formatted_entries = entries
    .map(
      (e, i) =>
        `[${i}] title: ${e.title}\ncontent: ${e.content.slice(0, 600)}`
    )
    .join("\n\n")

  const user_message = `USER_QUERY: ${user_query}
TOOL_QUERY: ${tool_query}

ENTRIES:
${formatted_entries}`

  try {
    const providers = build_check_providers()
    const result = await generate_object_with_fallback(
      providers,
      score_schema,
      [{ role: "user", content: user_message }],
      SCORE_SYSTEM_PROMPT,
      { max_tokens: 200, temperature: 0 }
    )

    console.log("RESULT", result)

    const idx = Math.min(result.best_entry_index, entries.length - 1)
    log.info(
      `score=${result.confidence.toFixed(2)} idx=${idx} reason="${result.reasoning}"`
    )

    return {
      confidence: result.confidence,
      best_entry_index: idx,
      reasoning: result.reasoning,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`scorer failed, defaulting to 0: ${msg}`)
    return { confidence: 0, best_entry_index: 0, reasoning: "scorer failure" }
  }
}
