/**
 * Public env vars. Only NEXT_PUBLIC_* are exposed to the browser.
 * Keep this file as the single source of truth never reference process.env elsewhere.
 */
export const ENV = {
  API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api",
  ADMIN_SECRET: process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "",
} as const
