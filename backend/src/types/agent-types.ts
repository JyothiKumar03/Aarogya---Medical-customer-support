export type TMessageSource = "kb" | "web" | "ai"

export type TMessage = {
  id: string
  session_id: string
  role: "user" | "assistant"
  content: string
  source?: TMessageSource
  confidence_score?: number
  metadata?: TResponseMetadata
}

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

export type TAgentResponse = {
  content: string
  metadata: TResponseMetadata
}
