import type { Request, Response } from "express"
import { create_ticket, list_tickets, get_ticket, resolve_ticket } from "../services/ticket-service"
import type { TCreateTicketBody } from "../types/ticket-types"
import { create_logger } from "../services/logger-service"

const log = create_logger("ticket-controller")

export async function handle_create_ticket(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as TCreateTicketBody

    if (!body.session_id || !Array.isArray(body.conversation_history)) {
      res.status(400).json({ error: "session_id and conversation_history are required" })
      return
    }

    const result = await create_ticket(body)
    res.status(201).json(result)
  } catch (err) {
    log.error("Create error", err)
    res.status(500).json({ error: "Failed to create ticket" })
  }
}

export async function handle_list_tickets(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))

    const result = await list_tickets(page, limit)
    res.json(result)
  } catch (err) {
    log.error("List error", err)
    res.status(500).json({ error: "Failed to list tickets" })
  }
}

export async function handle_get_ticket(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const ticket = await get_ticket(id)
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" })
      return
    }
    res.json(ticket)
  } catch (err) {
    log.error("Get error", err)
    res.status(500).json({ error: "Failed to get ticket" })
  }
}

export async function handle_resolve_ticket(req: Request, res: Response): Promise<void> {
  try {
    const { resolution_notes, add_to_kb } = req.body as {
      resolution_notes: string
      add_to_kb: boolean
    }

    if (!resolution_notes || typeof resolution_notes !== "string") {
      res.status(400).json({ error: "resolution_notes is required" })
      return
    }

    const id = req.params.id as string
    const ticket = await resolve_ticket(id, {
      resolution_notes,
      add_to_kb: Boolean(add_to_kb),
    })

    res.json(ticket)
  } catch (err) {
    log.error("Resolve error", err)
    res.status(500).json({ error: "Failed to resolve ticket" })
  }
}
