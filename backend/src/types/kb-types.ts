export type TKBEntry = {
  id: string
  title: string
  content: string
  tags: string[]
  embedding?: number[]
  source: "manual" | "ticket-resolution"
  ticket_id?: string
  created_at: Date
}

export type TKBSearchResult = {
  entry: TKBEntry
  raw_score: number
  confidence: number
}
