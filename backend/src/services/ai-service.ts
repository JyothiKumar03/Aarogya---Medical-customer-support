import { generateObject, streamText, type CoreMessage } from "ai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { type ZodType } from "zod"
import { ENV } from "../utils/env"
import { create_logger } from "./logger-service"

const log = create_logger("ai-service")

export type TAiProvider = "openai" | "anthropic" | "gemini"

export interface TProviderConfig {
  provider: TAiProvider
  model: string
  api_key: string
}

export interface TGenerateOptions {
  max_tokens?: number
  temperature?: number
}

const RETRIES_PER_PROVIDER = 2

export function create_model(cfg: TProviderConfig) {
  switch (cfg.provider) {
    case "openai":
      return createOpenAI({ apiKey: cfg.api_key })(cfg.model)
    case "anthropic":
      return createAnthropic({ apiKey: cfg.api_key })(cfg.model)
    case "gemini":
      return createGoogleGenerativeAI({ apiKey: cfg.api_key })(cfg.model)
  }
}

export function build_providers(): TProviderConfig[] {
  const providers: TProviderConfig[] = []

  if (ENV.OPENAI_API_KEY !== "not-set") {
    providers.push({
      provider: "openai",
      model: "gpt-4.1-mini",
      api_key: ENV.OPENAI_API_KEY,
    })
  }

  if (ENV.ANTHROPIC_API_KEY !== "not-set") {
    providers.push({
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      api_key: ENV.ANTHROPIC_API_KEY,
    })
  }

  if (ENV.GEMINI_API_KEY !== "not-set") {
    providers.push({
      provider: "gemini",
      model: "gemini-2.0-flash",
      api_key: ENV.GEMINI_API_KEY,
    })
  }

  if (providers.length === 0) {
    throw new Error("No AI providers configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY in .env")
  }

  return providers
}

// Check agents (KB score judge + web guardrail) run on a dedicated chain so
// the main agent's provider preference does not influence retrieval gating.
// Order: openai primary, gemini fallback.
export function build_check_providers(): TProviderConfig[] {
  const providers: TProviderConfig[] = []

  if (ENV.OPENAI_API_KEY !== "not-set") {
    providers.push({
      provider: "openai",
      model: "gpt-4.1-mini",
      api_key: ENV.OPENAI_API_KEY,
    })
  }

  if (ENV.GEMINI_API_KEY !== "not-set") {
    providers.push({
      provider: "gemini",
      model: "gemini-2.0-flash",
      api_key: ENV.GEMINI_API_KEY,
    })
  }

  if (providers.length === 0) {
    throw new Error(
      "No check providers configured. Set OPENAI_API_KEY and/or GEMINI_API_KEY in .env (used by score-service and web guardrail)."
    )
  }

  return providers
}

export async function generate_object_with_fallback<T>(
  providers: TProviderConfig[],
  schema: ZodType<T>,
  messages: CoreMessage[],
  sys_prompt: string,
  options: TGenerateOptions = {}
): Promise<T> {
  let last_error: Error | null = null

  for (const cfg of providers) {
    for (let attempt = 1; attempt <= RETRIES_PER_PROVIDER; attempt++) {
      try {
        const model = create_model(cfg)
        const { object } = await generateObject({
          model,
          schema,
          system: sys_prompt,
          messages,
          maxTokens: options.max_tokens ?? 3000,
          maxRetries: 0,
        })
        return object
      } catch (err) {
        last_error = err instanceof Error ? err : new Error(String(err))
        log.warn(`${cfg.provider}/${cfg.model} attempt ${attempt}/${RETRIES_PER_PROVIDER} failed: ${last_error.message}`)
        if (attempt < RETRIES_PER_PROVIDER) {
          await new Promise((r) => setTimeout(r, 600 * attempt))
        }
      }
    }
  }

  throw new Error(`All providers failed. Last: ${last_error?.message ?? "unknown"}`)
}

export async function* stream_text_with_fallback(
  providers: TProviderConfig[],
  messages: CoreMessage[],
  sys_prompt: string,
  options: TGenerateOptions = {}
): AsyncGenerator<string> {
  let last_error: Error | null = null

  for (const cfg of providers) {
    for (let attempt = 1; attempt <= RETRIES_PER_PROVIDER; attempt++) {
      try {
        const model = create_model(cfg)
        const { textStream } = await streamText({
          model,
          system: sys_prompt,
          messages,
          maxTokens: options.max_tokens ?? 2000,
          temperature: options.temperature ?? 0.2,
          maxRetries: 0,
        })

        let has_content = false
        for await (const chunk of textStream) {
          has_content = true
          yield chunk
        }
        if (!has_content) throw new Error("Model returned empty stream.")
        return
      } catch (err) {
        last_error = err instanceof Error ? err : new Error(String(err))
        log.warn(`${cfg.provider}/${cfg.model} attempt ${attempt}/${RETRIES_PER_PROVIDER} failed: ${last_error.message}`)
        if (attempt < RETRIES_PER_PROVIDER) {
          await new Promise((r) => setTimeout(r, 600 * attempt))
        }
      }
    }
  }

  throw new Error(`All providers failed. Last: ${last_error?.message ?? "unknown"}`)
}
