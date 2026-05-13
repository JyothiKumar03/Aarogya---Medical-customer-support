import { streamText, tool, type CoreMessage } from "ai"
import { z } from "zod"
import { create_model, type TProviderConfig } from "./ai-service"
import { search_kb } from "./kb-service"
import { score_kb_results } from "./score-service"
import { web_search } from "./search-service"
import { get_search_settings } from "./settings-service"
import { AGENT_SYSTEM_PROMPT } from "../constants/prompts"
import {
  KB_CONFIDENCE_THRESHOLD,
  WEB_CONFIDENCE_FLOOR,
} from "../constants/thresholds"
import prisma from "../db/client"
import { create_logger } from "./logger-service"

const log = create_logger("agent-service")

export type TWebSourceLink = {
  url: string
  title: string
}

export type TAgentResponseMetadata = {
  source: "kb" | "web" | "ai"
  confidence_score: number
  kb_entry_id?: string
  web_source_url?: string
  web_source_urls?: string[]
  web_relevant_urls?: TWebSourceLink[]
  web_irrelevant_urls?: TWebSourceLink[]
  search_result_id?: string
}

const RETRIES = 2

function extract_last_user_message(messages: CoreMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === "user") {
      return typeof m.content === "string"
        ? m.content
        : m.content
            .map((p) => ("text" in p ? p.text : ""))
            .join(" ")
            .trim()
    }
  }
  return ""
}

export async function stream_agent_response(
  provider: TProviderConfig,
  messages: CoreMessage[],
  session_id: string
): Promise<{
  textStream: AsyncIterable<string>
  metadata: Promise<TAgentResponseMetadata>
}> {
  let resolve_metadata!: (m: TAgentResponseMetadata) => void
  const metadata_promise = new Promise<TAgentResponseMetadata>((r) => {
    resolve_metadata = r
  })

  const user_query = extract_last_user_message(messages)
  const model = create_model(provider)
  let last_error: Error | null = null

  let allowed_domains: string[] = []
  let blocked_domains: string[] = []
  try {
    const settings = await get_search_settings()
    allowed_domains = Array.isArray(settings.allowed_domains) ? settings.allowed_domains : []
    blocked_domains = Array.isArray(settings.blocked_domains) ? settings.blocked_domains : []
  } catch (err) {
    log.warn(
      `Failed to load search settings, proceeding without grounding hints: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const grounding_block =
    allowed_domains.length > 0
      ? `\n\n## Web grounding context\n\nWhen the agent's KB is insufficient, web search is restricted to: ${allowed_domains.join(", ")}${blocked_domains.length > 0 ? ` (and explicitly excludes: ${blocked_domains.join(", ")})` : ""}.\n\nWhen you call smart_search:\n- Frame the 'query' for the publicly-known brand behind those domains (e.g. x.com → "x", y.com → "y", irdai.gov.in → "IRDAI"). Mention the brand once when relevant.\n- DO NOT include the internal persona name "InsureCo" in the 'query' field "InsureCo" is your internal employer name and has no presence on the public web; including it will sabotage retrieval.\n- DO NOT invent competitor insurer names. Only include other insurers if the user mentioned them verbatim.`
      : ""

  const system_prompt = AGENT_SYSTEM_PROMPT + grounding_block

  const query_description =
    allowed_domains.length > 0
      ? `The user's question reformulated for web/KB search. Web search is restricted to: ${allowed_domains.join(", ")}. Frame the query around the brand behind those domains (e.g. x.com → "x"). NEVER include "InsureCo" in this field it is an internal name with no public web presence.`
      : `The user's question reformulated for search. Keep it under 15 words; do not include the internal persona name "InsureCo" in this field.`

  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const { textStream } = await streamText({
        model,
        system: system_prompt,
        messages,
        tools: {
          smart_search: tool({
            description:
              "Search the knowledge base for health insurance information. Always call this for every user query. The decision to use KB or fall back to the web is made automatically you only receive the final result.",
            parameters: z.object({
              query: z.string().describe(query_description),
              tags: z
                .array(z.string())
                .describe(
                  "1-3 keyword tags from the approved list: operations, medicines, claims, billing, policy, wellness, network, hospitalisation, deductible, portal, coverage, emergency, physiotherapy, cashless, process, exclusions, maternity, waiting-period, ncb, renewal, portability, complaints"
                ),
            }),
            execute: async ({
              query,
              tags,
            }: {
              query: string
              tags: string[]
            }) => {
              try {
                // 1. RAG over KB (with optional tag filter applied in SQL).
                const kb_results = await search_kb(query, tags)

                // 2. Empty retrieval → skip the scorer (no point asking an
                //    LLM to rate zero entries) and go straight to web fallback.
                let confidence = 0
                let best_idx = 0
                let scorer_reason = "no kb hits"

                if (kb_results.length > 0) {
                  // 3. Small-agent relevance scoring over the RAG hits.
                  const scored = await score_kb_results(
                    user_query,
                    query,
                    kb_results.map((r) => r.entry)
                  )
                  confidence = scored.confidence
                  best_idx = scored.best_entry_index
                  scorer_reason = scored.reasoning
                }

                log.info(
                  `decision: kb_hits=${kb_results.length} confidence=${confidence.toFixed(2)} threshold=${KB_CONFIDENCE_THRESHOLD}`
                )

                // 4. KB path: must have hits AND scorer confidence >= 0.6.
                if (
                  kb_results.length > 0 &&
                  confidence >= KB_CONFIDENCE_THRESHOLD
                ) {
                  const best = kb_results[best_idx] ?? kb_results[0]

                  const search_result = await prisma.searchResult.create({
                    data: {
                      session_id,
                      query,
                      search_type: "kb",
                      results_json: JSON.stringify(kb_results),
                      confidence_score: confidence,
                      top_entry_id: best.entry.id,
                      used: true,
                    },
                  })

                  resolve_metadata({
                    source: "kb",
                    confidence_score: confidence,
                    kb_entry_id: best.entry.id,
                    search_result_id: search_result.id,
                  })

                  return {
                    found: true,
                    source: "kb",
                    confidence,
                    entries: [
                      {
                        id: best.entry.id,
                        title: best.entry.title,
                        content: best.entry.content,
                      },
                    ],
                  }
                }

                // 5. KB not confident enough → web fallback
                const web_result = await web_search(query)

                if (
                  web_result.found &&
                  web_result.relevant_urls &&
                  web_result.relevant_urls.length > 0
                ) {
                  const relevant = web_result.relevant_urls
                  const primary = relevant[0]
                  const all_urls = relevant.map((r) => r.url)

                  const search_result = await prisma.searchResult.create({
                    data: {
                      session_id,
                      query,
                      search_type: "web",
                      results_json: JSON.stringify(web_result),
                      confidence_score: WEB_CONFIDENCE_FLOOR,
                      web_source_url: primary.url,
                      used: true,
                    },
                  })

                  const irrelevant_links = (web_result.irrelevant_urls ?? []).map((r) => ({
                    url: r.url,
                    title: r.title,
                  }))
                  const relevant_links = relevant.map((r) => ({ url: r.url, title: r.title }))

                  resolve_metadata({
                    source: "web",
                    confidence_score: WEB_CONFIDENCE_FLOOR,
                    web_source_url: primary.url,
                    web_source_urls: all_urls,
                    web_relevant_urls: relevant_links,
                    web_irrelevant_urls: irrelevant_links,
                    search_result_id: search_result.id,
                  })

                  return {
                    found: true,
                    source: "web",
                    summary: web_result.summary ?? "",
                    relevant_urls: relevant.map((r) => ({
                      url: r.url,
                      title: r.title,
                    })),
                    disclaimer:
                      "Based on general web information (not your specific policy):",
                  }
                }

                // 5. Nothing usable surface the rejected web hits (if any)
                //    for transparency so the UI can show what was searched.
                const irrelevant_links = (web_result.irrelevant_urls ?? []).map((r) => ({
                  url: r.url,
                  title: r.title,
                }))

                resolve_metadata({
                  source: "ai",
                  confidence_score: 0,
                  web_irrelevant_urls: irrelevant_links.length > 0 ? irrelevant_links : undefined,
                })

                return {
                  found: false,
                  source: "ai",
                  reason: scorer_reason,
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                log.error(`smart_search failed: ${msg}`)
                resolve_metadata({
                  source: "ai",
                  confidence_score: 0,
                })
                throw err
              }
            },
          }),
        },
        maxSteps: 2,
        maxTokens: 2000,
        temperature: 0.2,
        maxRetries: 0,
        onFinish: () => {
          // If the model answered without calling smart_search (greeting,
          // off-topic decline, etc.), the tool path never resolved metadata.
          // Resolve to "ai" so the controller can write the done event.
          // No-op if the tool already resolved it.
          resolve_metadata({ source: "ai", confidence_score: 0 })
        },
      })

      return { textStream, metadata: metadata_promise }
    } catch (err) {
      last_error = err instanceof Error ? err : new Error(String(err))
      log.warn(`attempt ${attempt}/${RETRIES}: ${last_error.message}`)
      if (attempt < RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt))
      }
    }
  }

  throw new Error(
    `Agent failed after ${RETRIES} retries. Last: ${last_error?.message ?? "unknown"}`
  )
}
