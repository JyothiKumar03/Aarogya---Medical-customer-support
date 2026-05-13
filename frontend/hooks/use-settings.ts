"use client"

import { useState, useEffect } from "react"

type TSettings = {
  allowed_domains: string[]
  blocked_domains: string[]
}

export function use_settings() {
  const [settings, set_settings] = useState<TSettings>({
    allowed_domains: [],
    blocked_domains: [],
  })
  const [loading, set_loading] = useState(true)
  const [saving, set_saving] = useState(false)

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api"}/settings`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to fetch settings")
        return r.json()
      })
      .then((data) => {
        set_settings({
          allowed_domains: Array.isArray(data.allowed_domains) ? data.allowed_domains : [],
          blocked_domains: Array.isArray(data.blocked_domains) ? data.blocked_domains : [],
        })
        set_loading(false)
      })
      .catch(() => set_loading(false))
  }, [])

  async function save_settings() {
    set_saving(true)
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api"}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
    set_saving(false)
  }

  return { settings, set_settings, loading, saving, save_settings }
}
