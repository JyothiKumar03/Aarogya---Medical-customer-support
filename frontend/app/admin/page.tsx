"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  TicketStarIcon,
  Book01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  ArrowRight02Icon,
} from "@hugeicons/core-free-icons"
import { PageHeader } from "@/components/admin/page-header"
import { StatCard } from "@/components/admin/stat-card"
import { TicketStatusBadge } from "@/components/admin/ticket-status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useTickets } from "@/hooks/use-tickets"
import { useKB } from "@/hooks/use-kb"
import { formatRelativeTime } from "@/lib/utils"

export default function AdminDashboardPage() {
  const tickets = useTickets(1, 50)
  const kb = useKB()

  const all = tickets.data?.tickets ?? []
  const open = all.filter((t) => t.status !== "resolved").length
  const resolvedToday = all.filter((t) => {
    if (t.status !== "resolved") return false
    const d = new Date(t.updated_at)
    const today = new Date()
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    )
  }).length

  const recent = all.slice(0, 5)
  const fromTickets = kb.data?.filter((e) => e.source === "ticket-resolution").length ?? 0

  return (
    <div className="min-h-full">
      <PageHeader
        title="Dashboard"
        description="At-a-glance view of tickets and the knowledge base."
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total tickets"
            value={tickets.isLoading ? "—" : tickets.data?.total ?? 0}
            icon={TicketStarIcon}
            tone="primary"
          />
          <StatCard
            label="Open"
            value={tickets.isLoading ? "—" : open}
            icon={Clock01Icon}
            tone="warning"
            hint="Awaiting action"
          />
          <StatCard
            label="Resolved today"
            value={tickets.isLoading ? "—" : resolvedToday}
            icon={CheckmarkCircle02Icon}
            tone="success"
          />
          <StatCard
            label="KB entries"
            value={kb.isLoading ? "—" : kb.data?.length ?? 0}
            icon={Book01Icon}
            hint={fromTickets > 0 ? `${fromTickets} from tickets` : "All manual"}
            tone="muted"
          />
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <p className="text-sm font-semibold text-foreground">Recent tickets</p>
              <p className="text-xs text-muted-foreground">Last 5 activity</p>
            </div>
            <Link
              href="/admin/tickets"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all
              <HugeiconsIcon icon={ArrowRight02Icon} size={12} />
            </Link>
          </div>

          {tickets.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No tickets yet they'll appear here when customers escalate.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/tickets?id=${t.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      #{t.id.slice(0, 6)}
                    </span>
                    <span className="line-clamp-1 flex-1 text-sm text-foreground">
                      {t.query_summary}
                    </span>
                    <TicketStatusBadge status={t.status} />
                    <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                      {formatRelativeTime(t.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
