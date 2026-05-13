import prisma from "../db/client"
import type { TSearchSettings, TUpdateSearchSettingsBody } from "../types/settings-types"

export async function get_search_settings(): Promise<TSearchSettings> {
  let row = await prisma.searchSettings.findFirst()
  if (!row) {
    row = await prisma.searchSettings.create({
      data: {
        allowed_domains: JSON.stringify(["prudential.com"]),
        blocked_domains: JSON.stringify([]),
      },
    })
  }
  return {
    id: row.id,
    allowed_domains: JSON.parse(row.allowed_domains),
    blocked_domains: JSON.parse(row.blocked_domains),
    updated_at: row.updated_at,
  }
}

export async function update_search_settings(
  body: TUpdateSearchSettingsBody
): Promise<TSearchSettings> {
  const row = await prisma.searchSettings.findFirst()
  if (!row) throw new Error("Search settings not initialised")

  const updated = await prisma.searchSettings.update({
    where: { id: row.id },
    data: {
      allowed_domains: JSON.stringify(body.allowed_domains),
      blocked_domains: JSON.stringify(body.blocked_domains),
    },
  })

  return {
    id: updated.id,
    allowed_domains: JSON.parse(updated.allowed_domains),
    blocked_domains: JSON.parse(updated.blocked_domains),
    updated_at: updated.updated_at,
  }
}
