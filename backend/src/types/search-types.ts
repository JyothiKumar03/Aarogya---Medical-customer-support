export type TSearchType = "kb" | "web"

export type TSearchRecord = {
  id: string
  session_id: string
  query: string
  search_type: TSearchType
  results: unknown[]
  confidence_score: number
  top_entry_id?: string
  web_source_url?: string
  used: boolean
  created_at: Date
}
