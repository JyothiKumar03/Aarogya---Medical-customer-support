"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  GlobalSearchIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { TMessageSource } from "@/types"

type Props = {
  source: TMessageSource
  className?: string
}

const STYLES: Record<
  TMessageSource,
  { label: string; cls: string; icon: typeof CheckmarkCircle02Icon }
> = {
  kb: {
    label: "Answered from KB",
    icon: CheckmarkCircle02Icon,
    cls: "bg-success/10 text-success ring-success/20",
  },
  web: {
    label: "Answered from Web",
    icon: GlobalSearchIcon,
    cls: "bg-warning/10 text-warning ring-warning/25",
  },
  ai: {
    label: "Aarogya",
    icon: SparklesIcon,
    cls: "bg-muted text-muted-foreground ring-border",
  },
}

export function SourceBadge({ source, className }: Props) {
  const s = STYLES[source]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        s.cls,
        className
      )}
    >
      <HugeiconsIcon icon={s.icon} size={12} strokeWidth={2} />
      {s.label}
    </span>
  )
}
