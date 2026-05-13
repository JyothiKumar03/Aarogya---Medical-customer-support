import type { TMessage } from "./agent-types"

export type TTicketStatus = "open" | "in_progress" | "resolved"

export type TTicket = {
  id: string
  session_id: string
  query_summary: string
  conversation: TMessage[]
  status: TTicketStatus
  resolution_notes?: string
  resolution_summary?: string
  added_to_kb: boolean
  kb_entry_id?: string
  created_at: Date
  updated_at: Date
}
