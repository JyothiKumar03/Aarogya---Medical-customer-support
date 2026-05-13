"use client"

import { cn } from "@/lib/utils"

type Props = {
  score: number
  className?: string
}

export function ConfidencePill({ score, className }: Props) {
  const pct = Math.round(score * 100)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/20",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-primary" />
      KB match: {pct}%
    </span>
  )
}
