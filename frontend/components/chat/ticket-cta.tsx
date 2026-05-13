"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { CustomerSupportIcon, ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  onClick: () => void
  loading?: boolean
  className?: string
}

export function TicketCTA({ onClick, loading, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] px-3.5 py-2",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon icon={CustomerSupportIcon} size={15} strokeWidth={1.8} />
        </span>
        <div className="text-xs leading-tight">
          <p className="font-medium text-foreground">Still need help?</p>
          <p className="text-muted-foreground">
            Talk to a human we'll get back within 24 hours.
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        disabled={loading}
        className="shrink-0 text-primary hover:bg-primary/10"
      >
        {loading ? "Creating…" : "Create ticket"}
        {!loading && <HugeiconsIcon icon={ArrowRight02Icon} size={14} />}
      </Button>
    </div>
  )
}
