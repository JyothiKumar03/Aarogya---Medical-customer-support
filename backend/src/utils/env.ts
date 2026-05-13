type TEnv = {
  PORT: string
  DATABASE_URL: string
  OPENAI_API_KEY: string
  ANTHROPIC_API_KEY: string
  GEMINI_API_KEY: string
  TAVILY_API_KEY: string
  ADMIN_SECRET: string
  FRONTEND_URL: string
  NODE_ENV: string
}

export const ENV: TEnv = {
  PORT: Bun.env.PORT ?? "8000",
  DATABASE_URL: Bun.env.DATABASE_URL ?? "not-set",
  OPENAI_API_KEY: Bun.env.OPENAI_API_KEY ?? "not-set",
  ANTHROPIC_API_KEY: Bun.env.ANTHROPIC_API_KEY ?? "not-set",
  GEMINI_API_KEY: Bun.env.GEMINI_API_KEY ?? "not-set",
  TAVILY_API_KEY: Bun.env.TAVILY_API_KEY ?? "not-set",
  ADMIN_SECRET: Bun.env.ADMIN_SECRET ?? "not-set",
  FRONTEND_URL: Bun.env.FRONTEND_URL ?? "http://localhost:3000",
  NODE_ENV: Bun.env.NODE_ENV ?? "development",
} as const
