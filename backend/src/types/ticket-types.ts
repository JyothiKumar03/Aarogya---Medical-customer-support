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
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  additional_details?: string
  created_at: Date
  updated_at: Date
}

export type TCreateTicketBody = {
  session_id: string
  conversation_history: TMessage[]
  customer_name: string
  customer_email: string
  customer_phone?: string
  additional_details?: string
}

export type TResolveTicketBody = {
  resolution_notes: string
  add_to_kb: boolean
}
