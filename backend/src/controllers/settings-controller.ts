import type { Request, Response } from "express"
import { get_search_settings, update_search_settings } from "../services/settings-service"

export async function handle_get_settings(req: Request, res: Response) {
  try {
    const settings = await get_search_settings()
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" })
  }
}

export async function handle_update_settings(req: Request, res: Response) {
  try {
    const { allowed_domains, blocked_domains } = req.body
    if (!Array.isArray(allowed_domains) || !Array.isArray(blocked_domains)) {
      res.status(400).json({ error: "allowed_domains and blocked_domains must be arrays" })
      return
    }
    const settings = await update_search_settings({ allowed_domains, blocked_domains })
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" })
  }
}
