import type { TKBEntry, TKBSearchResult } from "../types/kb-types"

export function format_kb_results_for_claude(results: TKBSearchResult[]): string {
  return results
    .map(
      (r, i) =>
        `${i + 1}. Title: ${r.entry.title} / Content: ${r.entry.content.slice(0, 200)} (confidence: ${Math.round(r.confidence * 100)}%)`
    )
    .join("\n")
}

export function format_kb_entries_for_scoring(query: string, entries: TKBEntry[]): string {
  const header = `Query: "${query}"\n\nKB Entries:\n`
  const body = entries
    .map((e, i) => `${i + 1}. Title: ${e.title} / Content: ${e.content}`)
    .join("\n")
  return header + body
}
