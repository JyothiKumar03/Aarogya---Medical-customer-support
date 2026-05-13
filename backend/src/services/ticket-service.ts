import { z } from "zod"
import prisma from "../db/client"
import type { TMessage } from "../types/agent-types"
import type { TTicketStatus, TTicket } from "../types/ticket-types"
import { generate_object_with_fallback, build_providers } from "./ai-service"
import { TICKET_SUMMARY_PROMPT } from "../constants/prompts"

function ticket_from_db(row: {
  id: string
  session_id: string
  query_summary: string
  conversation_json: string
  status: string
  resolution_notes: string | null
  resolution_summary: string | null
  added_to_kb: boolean
  kb_entry_id: string | null
  created_at: Date
  updated_at: Date
}): TTicket {
  return {
    id: row.id,
    session_id: row.session_id,
    query_summary: row.query_summary,
    conversation: JSON.parse(row.conversation_json) as TMessage[],
    status: row.status as TTicketStatus,
    resolution_notes: row.resolution_notes ?? undefined,
    resolution_summary: row.resolution_summary ?? undefined,
    added_to_kb: row.added_to_kb,
    kb_entry_id: row.kb_entry_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

const summary_schema = z.object({ summary: z.string() })

export async function create_ticket(
  session_id: string,
  conversation: TMessage[]
): Promise<{ ticket_id: string; status: string; query_summary: string }> {
  const user_messages = conversation
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content)
    .join(" ")

  const providers = build_providers()
  const { summary } = await generate_object_with_fallback(
    providers,
    summary_schema,
    [{ role: "user", content: user_messages || "Customer support query" }],
    TICKET_SUMMARY_PROMPT,
    { max_tokens: 100, temperature: 0 }
  )

  const ticket = await prisma.ticket.create({
    data: {
      session_id,
      query_summary: summary,
      conversation_json: JSON.stringify(conversation),
      status: "open",
    },
  })

  return {
    ticket_id: ticket.id,
    status: ticket.status,
    query_summary: summary,
  }
}

export async function list_tickets(
  page = 1,
  limit = 20
): Promise<{ tickets: TTicket[]; total: number }> {
  const skip = (page - 1) * limit

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
    }),
    prisma.ticket.count(),
  ])

  return {
    tickets: rows.map(ticket_from_db),
    total,
  }
}

export async function get_ticket(id: string): Promise<TTicket | null> {
  const row = await prisma.ticket.findUnique({ where: { id } })
  return row ? ticket_from_db(row) : null
}

export async function resolve_ticket(
  id: string,
  data: { resolution_notes: string; add_to_kb: boolean }
): Promise<TTicket> {
  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) throw new Error(`Ticket ${id} not found`)

  const updateData: {
    status: string
    resolution_notes: string
    resolution_summary?: string
    added_to_kb?: boolean
    kb_entry_id?: string
  } = {
    status: "resolved",
    resolution_notes: data.resolution_notes,
  }

  if (data.add_to_kb) {
    const { generate_resolution_summary } = await import("./summarise-service")
    const summary = await generate_resolution_summary(
      JSON.parse(ticket.conversation_json) as TMessage[],
      data.resolution_notes
    )

    updateData.resolution_summary = JSON.stringify(summary)

    const { create_kb_entry } = await import("./kb-service")
    const kb_entry = await create_kb_entry({
      tags: summary.tags,
      title: summary.title,
      content: summary.content,
      source: "ticket-resolution",
      ticket_id: id,
    })

    updateData.added_to_kb = true
    updateData.kb_entry_id = kb_entry.id
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: updateData,
  })

  return ticket_from_db(updated)
}
