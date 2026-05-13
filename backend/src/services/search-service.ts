import { tavily } from "@tavily/core"
import { z } from "zod"
import { generate_object_with_fallback, build_check_providers } from "./ai-service"
import { WEB_GUARDRAIL_PROMPT } from "../constants/prompts"
import { ENV } from "../utils/env"
import { create_logger } from "./logger-service"
import { get_search_settings } from "./settings-service"
import type { TSearchSettings } from "../types/settings-types"

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
    throw new Error("TAVILY_API_KEY_NOT_CONFIGURED")
  }
  _client = tavily({ apiKey: ENV.TAVILY_API_KEY })
  return _client
}

const MAX_RESULTS = 5
const TAVILY_TIMEOUT_MS = 15_000

const DEFAULT_SETTINGS: Pick<TSearchSettings, "allowed_domains" | "blocked_domains"> = {
  allowed_domains: ["prudential.com"],
  blocked_domains: [],
}

const guardrail_schema = z.object({
  final_summarized_output: z.string(),
  relevant_urls: z.array(z.string()),
  irrelevant_urls: z.array(z.string()),
  reasoning: z.string().max(200),
})

function normalise_url(u: string): string {
  try {
    const parsed = new URL(u)
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase()
    const path = parsed.pathname.replace(/\/+$/, "")
    return `${host}${path}`
  } catch {
    return u.trim().toLowerCase().replace(/\/+$/, "")
  }
}

async function load_settings_safely(): Promise<
  Pick<TSearchSettings, "allowed_domains" | "blocked_domains">
> {
  try {
    const s = await get_search_settings()
    return {
      allowed_domains: Array.isArray(s.allowed_domains) ? s.allowed_domains : [],
      blocked_domains: Array.isArray(s.blocked_domains) ? s.blocked_domains : [],
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`Failed to load search settings, falling back to defaults: ${msg}`)
    return DEFAULT_SETTINGS
  }
}

function with_timeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export async function web_search(query: string): Promise<TWebSearchResult> {
  if (ENV.TAVILY_API_KEY === "not-set") {
    log.warn("Web search skipped: TAVILY_API_KEY is not configured")
    return { found: false }
  }

  const settings = await load_settings_safely()

  let client: ReturnType<typeof tavily>
  try {
    client = get_client()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`Tavily client unavailable: ${msg}`)
    return { found: false }
  }

  const include = settings.allowed_domains.length > 0 ? settings.allowed_domains : undefined
  const exclude = settings.blocked_domains.length > 0 ? settings.blocked_domains : undefined

  log.info(
    `Tavily search query="${query}" include=${include ? include.join(",") : "<none>"} exclude=${exclude ? exclude.join(",") : "<none>"}`,
  )

  let response: Awaited<ReturnType<typeof client.search>>
  try {
    response = await with_timeout(
      client.search(query, {
        maxResults: MAX_RESULTS,
        searchDepth: "advanced",
        includeDomains: include,
        excludeDomains: exclude,
      }),
      TAVILY_TIMEOUT_MS,
      "Tavily search",
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`Tavily search failed: ${msg}`)
    return { found: false }
  }

  const raw = response.results ?? []
  log.info('TAVILY RESPONSE', JSON.stringify(raw))
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
    log.warn("Guardrail unavailable; suppressing raw hits")
    return { found: false }
  }

  log.info('Guard',JSON.stringify(guard))

  const url_to_hit = new Map(hits.map((h) => [normalise_url(h.url), h]))
  const map_urls = (urls: string[]): TWebSearchHit[] => {
    const seen = new Set<string>()
    const out: TWebSearchHit[] = []
    for (const u of urls) {
      const key = normalise_url(u)
      const hit = url_to_hit.get(key)
      if (hit && !seen.has(key)) {
        seen.add(key)
        out.push(hit)
      }
    }
    return out
  }

  const relevant_urls = map_urls(guard.relevant_urls)
  const irrelevant_urls = map_urls(guard.irrelevant_urls)

  if (relevant_urls.length === 0) {
    log.warn(`Guardrail rejected all ${hits.length} web hits: ${guard.reasoning}`)
    return {
      found: false,
      reasoning: guard.reasoning,
      irrelevant_urls,
    }
  }

  log.info(
    `Web hits: relevant=${relevant_urls.length} irrelevant=${irrelevant_urls.length}`,
  )

  return {
    found: true,
    summary: guard.final_summarized_output,
    relevant_urls,
    irrelevant_urls,
    reasoning: guard.reasoning,
  }
}

async function classify_and_summarise(
  user_query: string,
  hits: TWebSearchHit[],
): Promise<z.infer<typeof guardrail_schema> | null> {
  const formatted = hits
    .map(
      (h, i) =>
        `[${i}] title: ${h.title}\nurl: ${h.url}\ncontent: ${h.content.slice(0, 800)}`,
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
      { max_tokens: 800, temperature: 0 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`Guardrail/summariser LLM failed: ${msg}`)
    return null
  }
}
