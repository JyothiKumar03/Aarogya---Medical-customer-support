/**
 * Shared frontend types mirror the backend `T<Camel>` convention so server / client
 * speak the same language. Source of truth lives in `backend/src/types`; keep these
 * in sync if the backend contract changes.
 */

export type TMessageRole = "user" | "assistant"
export type TMessageSource = "kb" | "web" | "ai"
export type TTicketStatus = "open" | "in_progress" | "resolved"
export type TKBSource = "manual" | "ticket-resolution"

export type TWebSourceLink = {
  url: string
  title: string
}

export type TResponseMetadata = {
  source: TMessageSource
  confidence_score?: number
  kb_entry_id?: string
  web_source_url?: string
  web_source_urls?: string[]
  web_relevant_urls?: TWebSourceLink[]
  web_irrelevant_urls?: TWebSourceLink[]
  search_result_id?: string
}

export type TMessage = {
  id: string
  session_id?: string
  role: TMessageRole
  content: string
  source?: TMessageSource
  confidence_score?: number
  metadata?: TResponseMetadata
  created_at?: string
  /** Local-only flag for in-flight assistant turns. */
  pending?: boolean
  /** Local-only flag if streaming errored. */
  errored?: boolean
}

export type TKBEntry = {
  id: string
  title: string
  content: string
  tags: string[]
  source: TKBSource
  ticket_id?: string
  created_at: string
}

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
  created_at: string
  updated_at: string
}

export type TTicketListResponse = {
  tickets: TTicket[]
  total: number
}

export type TCreateTicketResponse = {
  ticket_id: string
  status: string
  query_summary: string
}

export type TKBListResponse = {
  entries: TKBEntry[]
}

export type TStreamEvent =
  | { type: "delta"; text: string }
  | { type: "metadata"; metadata: TResponseMetadata }
  | { type: "done" }
  | { type: "error"; message: string }
