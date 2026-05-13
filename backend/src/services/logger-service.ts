import { ENV } from "../utils/env"

/**
 * Tiny structured logger. Single source of truth for backend logging.
 * Levels: debug < info < warn < error. Set LOG_LEVEL=debug in dev to see
 * everything; defaults to "info" in dev, "warn" in production.
 *
 * Usage:
 *   const log = create_logger("chat-controller")
 *   log.info("Handling request", { session_id })
 *   log.error("Stream failed", err)
 */

type TLogLevel = "debug" | "info" | "warn" | "error"

const LEVEL_ORDER: Record<TLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const COLORS: Record<TLogLevel, string> = {
  debug: "\x1b[90m", // gray
  info: "\x1b[36m",  // cyan
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
}
const DIM = "\x1b[2m"
const BOLD = "\x1b[1m"
const RESET = "\x1b[0m"

const ENV_LEVEL = (Bun.env.LOG_LEVEL as TLogLevel | undefined)
const DEFAULT_LEVEL: TLogLevel =
  ENV.NODE_ENV === "production" ? "warn" : "info"
const ACTIVE_LEVEL: TLogLevel =
  ENV_LEVEL && ENV_LEVEL in LEVEL_ORDER ? ENV_LEVEL : DEFAULT_LEVEL

function should_log(level: TLogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[ACTIVE_LEVEL]
}

function format_meta(meta: unknown): string {
  if (meta === undefined) return ""
  if (meta instanceof Error) {
    return ` ${meta.name}: ${meta.message}${meta.stack ? `\n${meta.stack}` : ""}`
  }
  if (typeof meta === "string") return ` ${meta}`
  try {
    return ` ${JSON.stringify(meta)}`
  } catch {
    return ` ${String(meta)}`
  }
}

function emit(scope: string, level: TLogLevel, message: string, meta?: unknown): void {
  if (!should_log(level)) return
  const stamp = new Date().toISOString()
  const tag = `${COLORS[level]}${BOLD}${level.toUpperCase().padEnd(5)}${RESET}`
  const head = `${DIM}${stamp}${RESET} ${tag} ${DIM}[${scope}]${RESET}`
  const line = `${head} ${message}${format_meta(meta)}`
  if (level === "error" || level === "warn") {
    // eslint-disable-next-line no-console
    console.error(line)
  } else {
    // eslint-disable-next-line no-console
    console.log(line)
  }
}

export type TLogger = {
  debug: (message: string, meta?: unknown) => void
  info: (message: string, meta?: unknown) => void
  warn: (message: string, meta?: unknown) => void
  error: (message: string, meta?: unknown) => void
  child: (sub_scope: string) => TLogger
}

export function create_logger(scope: string): TLogger {
  return {
    debug: (m, meta) => emit(scope, "debug", m, meta),
    info: (m, meta) => emit(scope, "info", m, meta),
    warn: (m, meta) => emit(scope, "warn", m, meta),
    error: (m, meta) => emit(scope, "error", m, meta),
    child: (sub) => create_logger(`${scope}:${sub}`),
  }
}

/** Default root logger for one-off log lines without scope. */
export const log = create_logger("app")
