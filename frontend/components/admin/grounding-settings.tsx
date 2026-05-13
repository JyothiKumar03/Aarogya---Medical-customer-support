"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { use_settings } from "@/hooks/use-settings"

const DOMAIN_RE = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function GroundingSettings() {
  const { settings, set_settings, loading, saving, save_settings } = use_settings()
  const [allowedInput, setAllowedInput] = useState("")
  const [blockedInput, setBlockedInput] = useState("")

  const addAllowed = () => {
    const d = allowedInput.trim().toLowerCase()
    if (!DOMAIN_RE.test(d)) {
      toast.error("Enter a valid domain (e.g. example.com)")
      return
    }
    if (settings.allowed_domains.includes(d)) {
      toast.error("Domain already in allowed list")
      return
    }
    set_settings((prev) => ({
      ...prev,
      allowed_domains: [...prev.allowed_domains, d],
    }))
    setAllowedInput("")
  }

  const removeAllowed = (domain: string) => {
    set_settings((prev) => ({
      ...prev,
      allowed_domains: prev.allowed_domains.filter((d) => d !== domain),
    }))
  }

  const addBlocked = () => {
    const d = blockedInput.trim().toLowerCase()
    if (!DOMAIN_RE.test(d)) {
      toast.error("Enter a valid domain (e.g. example.com)")
      return
    }
    if (settings.blocked_domains.includes(d)) {
      toast.error("Domain already in blocked list")
      return
    }
    set_settings((prev) => ({
      ...prev,
      blocked_domains: [...prev.blocked_domains, d],
    }))
    setBlockedInput("")
  }

  const removeBlocked = (domain: string) => {
    set_settings((prev) => ({
      ...prev,
      blocked_domains: prev.blocked_domains.filter((d) => d !== domain),
    }))
  }

  const handleSave = async () => {
    try {
      await save_settings()
      toast.success("Settings saved", {
        description: "Changes apply immediately to all new queries.",
      })
    } catch {
      toast.error("Failed to save settings")
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Web Search Grounding</h2>
        <p className="text-sm text-muted-foreground">
          Control which domains the AI can search. Changes apply immediately to all
          new queries.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-green-500" />
            <Label className="text-sm font-medium">Allowed Domains</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            AI will only surface results from these domains.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {settings.allowed_domains.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400"
              >
                {d}
                <button
                  type="button"
                  onClick={() => removeAllowed(d)}
                  className="ml-0.5 text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={allowedInput}
              onChange={(e) => setAllowedInput(e.target.value)}
              placeholder="example.com"
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addAllowed()}
            />
            <Button type="button" variant="outline" size="sm" onClick={addAllowed}>
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500" />
            <Label className="text-sm font-medium">Blocked Domains</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Results from these domains will never be shown.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {settings.blocked_domains.map((d) => (
              <span
                key={d}
                className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400"
              >
                {d}
                <button
                  type="button"
                  onClick={() => removeBlocked(d)}
                  className="ml-0.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={blockedInput}
              onChange={(e) => setBlockedInput(e.target.value)}
              placeholder="example.com"
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addBlocked()}
            />
            <Button type="button" variant="outline" size="sm" onClick={addBlocked}>
              Add
            </Button>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  )
}
