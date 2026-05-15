import type { Request, Response } from "express"
import { z } from "zod"
import { get_search_settings, update_search_settings } from "../services/settings-service"

const domain_list = z
  .array(z.string().trim().min(1))
  .transform((arr) => Array.from(new Set(arr.map((d) => d.toLowerCase()))))

const update_settings_schema = z
  .object({
    allowed_domains: domain_list,
    blocked_domains: domain_list,
  })
  .superRefine((val, ctx) => {
    const blocked = new Set(val.blocked_domains)
    const overlap = val.allowed_domains.filter((d) => blocked.has(d))
    if (overlap.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Domains cannot appear in both lists: ${overlap.join(", ")}`,
        path: ["allowed_domains"],
      })
    }
  })

export async function handle_get_settings(req: Request, res: Response) {
  try {
    const settings = await get_search_settings()
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" })
  }
}

export async function handle_update_settings(req: Request, res: Response) {
  const parsed = update_settings_schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_settings",
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    })
    return
  }
  try {
    const settings = await update_search_settings(parsed.data)
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" })
  }
}
