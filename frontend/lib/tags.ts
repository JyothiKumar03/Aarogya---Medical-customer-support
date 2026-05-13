/**
 * Mirrors backend `src/constants/tags.ts`. Keep in sync if the backend changes.
 */
export const APPROVED_TAGS = [
  "operations",
  "medicines",
  "claims",
  "billing",
  "policy",
  "wellness",
  "network",
  "hospitalisation",
  "deductible",
  "portal",
  "coverage",
  "emergency",
  "physiotherapy",
  "cashless",
  "process",
  "exclusions",
  "maternity",
  "mental-health",
  "waiting-period",
  "ncb",
  "renewal",
  "portability",
  "complaints",
] as const

export type TKBTag = (typeof APPROVED_TAGS)[number]
