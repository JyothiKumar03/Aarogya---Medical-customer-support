import type { Request, Response } from "express"
import { list_kb_entries, create_kb_entry, delete_kb_entry } from "../services/kb-service"
import { create_logger } from "../services/logger-service"

const log = create_logger("kb-controller")

export async function handle_list_kb(_req: Request, res: Response): Promise<void> {
  try {
    const entries = await list_kb_entries()
    res.json({ entries })
  } catch (err) {
    log.error("List error", err)
    res.status(500).json({ error: "Failed to list KB entries" })
  }
}

export async function handle_create_kb(req: Request, res: Response): Promise<void> {
  try {
    const { title, content, tags, source } = req.body as {
      title: string
      content: string
      tags: string[]
      source?: "manual" | "ticket-resolution"
    }

    if (!title || !content || !Array.isArray(tags)) {
      res.status(400).json({ error: "title, content, and tags are required" })
      return
    }

    const entry = await create_kb_entry({
      title,
      content,
      tags,
      source: source ?? "manual",
    })

    res.status(201).json(entry)
  } catch (err) {
    log.error("Create error", err)
    res.status(500).json({ error: "Failed to create KB entry" })
  }
}

export async function handle_delete_kb(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    await delete_kb_entry(id)
    res.json({ ok: true })
  } catch (err) {
    log.error("Delete error", err)
    res.status(500).json({ error: "Failed to delete KB entry" })
  }
}
