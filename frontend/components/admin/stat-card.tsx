"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import type { TicketStarIcon as IconType } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

type Tone = "primary" | "success" | "warning" | "muted"

type Props = {
  label: string
  value: number | string
  hint?: string
  icon: typeof IconType
  tone?: Tone
}

const TONES: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-muted text-muted-foreground",
}

export function StatCard({ label, value, hint, icon, tone = "primary" }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            TONES[tone]
          )}
        >
          <HugeiconsIcon icon={icon} size={15} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
