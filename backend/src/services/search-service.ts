import { tavily } from "@tavily/core"
import { z } from "zod"
import { generate_object_with_fallback, build_check_providers } from "./ai-service"
import { WEB_GUARDRAIL_PROMPT } from "../constants/prompts"
import { ENV } from "../utils/env"
import { create_logger } from "./logger-service"

const log = create_logger("search-service")

export type TWebSearchHit = {
  url: string
  title: string
  content: string
}

export type TWebSearchResult = {
  found: boolean
  summary?: string
  relevant_urls?: TWebSearchHit[]
  irrelevant_urls?: TWebSearchHit[]
  reasoning?: string
}

let _client: ReturnType<typeof tavily> | null = null
function get_client(): ReturnType<typeof tavily> {
  if (_client) return _client
  if (ENV.TAVILY_API_KEY === "not-set") {
    throw new Error("TAVILY_API_KEY is not configured")
  }
  _client = tavily({ apiKey: ENV.TAVILY_API_KEY })
  return _client
}

const MAX_RESULTS = 5

const guardrail_schema = z.object({
  final_summarized_output: z.string(),
  relevant_urls: z.array(z.string()),
  irrelevant_urls: z.array(z.string()),
  reasoning: z.string().max(200),
})

export async function web_search(query: string): Promise<TWebSearchResult> {
  const enhanced_query = `${query} health insurance India`

  try {
    const client = get_client()
    const response = await client.search(enhanced_query, {
      maxResults: MAX_RESULTS,
      searchDepth: "basic",
    })

    const raw = response.results ?? []
    if (raw.length === 0) {
      log.info("Tavily returned no results")
      return { found: false }
    }

    const hits: TWebSearchHit[] = raw.map((r) => ({
      url: r.url,
      title: r.title ?? r.url,
      content: r.content ?? "",
    }))

    const guard = await classify_and_summarise(query, hits)
    if (!guard) {
      // LLM unavailable. Conservative: surface nothing rather than raw hits.
      return { found: false }
    }

    const url_to_hit = new Map(hits.map((h) => [h.url, h]))
    const relevant_urls = guard.relevant_urls
      .map((u) => url_to_hit.get(u))
      .filter((h): h is TWebSearchHit => Boolean(h))
    const irrelevant_urls = guard.irrelevant_urls
      .map((u) => url_to_hit.get(u))
      .filter((h): h is TWebSearchHit => Boolean(h))

    if (relevant_urls.length === 0) {
      log.warn(
        `Guardrail rejected all ${hits.length} web hits: ${guard.reasoning}`
      )
      return {
        found: false,
        reasoning: guard.reasoning,
        irrelevant_urls,
      }
    }

    log.info(
      `Web hits: relevant=${relevant_urls.length} irrelevant=${irrelevant_urls.length}`
    )

    return {
      found: true,
      summary: guard.final_summarized_output,
      relevant_urls,
      irrelevant_urls,
      reasoning: guard.reasoning,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`Web search failed: ${msg}`)
    return { found: false }
  }
}

async function classify_and_summarise(
  user_query: string,
  hits: TWebSearchHit[]
): Promise<z.infer<typeof guardrail_schema> | null> {
  const formatted = hits
    .map(
      (h, i) =>
        `[${i}] title: ${h.title}\nurl: ${h.url}\ncontent: ${h.content.slice(0, 800)}`
    )
    .join("\n\n")

  const user_message = `USER_QUERY: ${user_query}\n\nRESULTS:\n${formatted}`

  try {
    const providers = build_check_providers()
    return await generate_object_with_fallback(
      providers,
      guardrail_schema,
      [{ role: "user", content: user_message }],
      WEB_GUARDRAIL_PROMPT,
      { max_tokens: 800, temperature: 0 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`Guardrail/summariser LLM failed: ${msg}`)
    return null
  }
}
