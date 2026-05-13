"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { TicketStatusBadge } from "./ticket-status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeTime } from "@/lib/utils"
import type { TTicket } from "@/types"

type Props = {
  tickets?: TTicket[]
  isLoading?: boolean
  onSelect: (id: string) => void
}

export function TicketTable({ tickets, isLoading, onSelect }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (!tickets?.length) {
    return (
      <div className="px-5 py-16 text-center text-sm text-muted-foreground">
        No tickets to show.
      </div>
    )
  }

  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[90px_1fr_120px_140px_100px_120px_40px] items-center gap-3 border-b border-border bg-muted/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <div>ID</div>
        <div>Summary</div>
        <div>Customer</div>
        <div>Contact</div>
        <div>Status</div>
        <div>Created</div>
        <div />
      </div>
      <ul className="divide-y divide-border">
        {tickets.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              className="grid w-full grid-cols-[90px_1fr_120px_140px_100px_120px_40px] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-accent/40"
            >
              <span className="font-mono text-xs text-muted-foreground">
                #{t.id.slice(0, 6)}
              </span>
              <span className="line-clamp-1 text-sm text-foreground">
                {t.query_summary}
              </span>
              <div className="min-w-0">
                <span className="block truncate text-sm text-foreground">
                  {t.customer_name ?? "—"}
                </span>
                {t.customer_email && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.customer_email}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {t.customer_phone ?? "—"}
              </span>
              <TicketStatusBadge status={t.status} />
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(t.created_at)}
              </span>
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                size={14}
                className="justify-self-end text-muted-foreground"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
