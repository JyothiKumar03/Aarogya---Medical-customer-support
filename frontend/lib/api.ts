import axios, { AxiosInstance } from "axios"
import { ENV } from "./env"
import type {
  TCreateTicketResponse,
  TKBEntry,
  TKBListResponse,
  TMessage,
  TStreamEvent,
  TTicket,
  TTicketListResponse,
} from "@/types"

/* ─── HTTP client ─────────────────────────────────────────── */

export const http: AxiosInstance = axios.create({
  baseURL: ENV.API_BASE_URL,
  headers: { "Content-Type": "application/json" },
})

if (ENV.ADMIN_SECRET) {
  http.defaults.headers.common["x-admin-secret"] = ENV.ADMIN_SECRET
}

/* ─── Tickets ─────────────────────────────────────────────── */

export const ticketApi = {
  list: async (page = 1, limit = 50): Promise<TTicketListResponse> => {
    const { data } = await http.get<TTicketListResponse>("/tickets", {
      params: { page, limit },
    })
    return data
  },
  get: async (id: string): Promise<TTicket> => {
    const { data } = await http.get<TTicket>(`/tickets/${id}`)
    return data
  },
  create: async (payload: {
    session_id: string
    conversation_history: TMessage[]
    customer_name: string
    customer_email: string
    customer_phone?: string
  }): Promise<TCreateTicketResponse> => {
    const { data } = await http.post<TCreateTicketResponse>("/tickets", payload)
    return data
  },
  resolve: async (
    id: string,
    payload: { resolution_notes: string; add_to_kb: boolean }
  ): Promise<TTicket> => {
    const { data } = await http.patch<TTicket>(`/tickets/${id}`, payload)
    return data
  },
}

/* ─── Knowledge Base ──────────────────────────────────────── */

export const kbApi = {
  list: async (): Promise<TKBEntry[]> => {
    const { data } = await http.get<TKBListResponse>("/kb")
    return data.entries
  },
  create: async (payload: {
    title: string
    content: string
    tags: string[]
    source?: "manual" | "ticket-resolution"
  }): Promise<TKBEntry> => {
    const { data } = await http.post<TKBEntry>("/kb", payload)
    return data
  },
  remove: async (id: string): Promise<void> => {
    await http.delete(`/kb/${id}`)
  },
}

/* ─── Chat SSE stream ─────────────────────────────────────── */

export type TStreamHandlers = {
  onDelta: (text: string) => void
  onMetadata: (m: TStreamEvent & { type: "metadata" }) => void
  onDone: () => void
  onError: (err: Error) => void
  signal?: AbortSignal
}

/**
 * Stream a chat response from the backend. Parses SSE manually because
 * EventSource doesn't support POST bodies.
 */
export async function streamChat(
  payload: {
    session_id: string
    message: string
    conversation_history: TMessage[]
  },
  handlers: TStreamHandlers
): Promise<void> {
  try {
    const res = await fetch(`${ENV.API_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      signal: handlers.signal,
    })

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => res.statusText)
      throw new Error(`Stream failed: ${res.status} ${errText}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sepIdx: number
      while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIdx)
        buffer = buffer.slice(sepIdx + 2)
        const event = parseSseEvent(rawEvent)
        if (!event) continue
        if (event.type === "delta") handlers.onDelta(event.text)
        else if (event.type === "metadata") handlers.onMetadata(event)
        else if (event.type === "done") handlers.onDone()
        else if (event.type === "error") handlers.onError(new Error(event.message))
      }
    }
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      handlers.onDone()
      return
    }
    handlers.onError(err as Error)
  }
}

function parseSseEvent(raw: string): TStreamEvent | null {
  let eventType = "message"
  let dataLine = ""
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) eventType = line.slice(6).trim()
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim()
  }
  if (!dataLine) return null

  try {
    if (eventType === "delta") {
      const text = JSON.parse(dataLine) as string
      return { type: "delta", text }
    }
    if (eventType === "metadata") {
      return { type: "metadata", metadata: JSON.parse(dataLine) }
    }
    if (eventType === "done") return { type: "done" }
    if (eventType === "error") {
      const parsed = JSON.parse(dataLine) as { error?: string }
      return { type: "error", message: parsed.error ?? "Unknown error" }
    }
  } catch {
    return null
  }
  return null
}
