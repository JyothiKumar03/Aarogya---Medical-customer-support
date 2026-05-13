"use client"

import { Suspense, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { PageHeader } from "@/components/admin/page-header"
import { TicketTable } from "@/components/admin/ticket-table"
import { TicketDrawer } from "@/components/admin/ticket-drawer"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTickets } from "@/hooks/use-tickets"
import type { TTicketStatus } from "@/types"

type Filter = "all" | TTicketStatus

function TicketsPageInner() {
  const search = useSearchParams()
  const router = useRouter()
  const initialId = search.get("id")

  const [filter, setFilter] = useState<Filter>("all")
  const [q, setQ] = useState("")
  const [openId, setOpenId] = useState<string | null>(initialId)

  const { data, isLoading } = useTickets(1, 100)

  const filtered = (data?.tickets ?? [])
    .filter((t) => (filter === "all" ? true : t.status === filter))
    .filter((t) =>
      q.trim()
        ? `${t.id} ${t.query_summary}`.toLowerCase().includes(q.toLowerCase())
        : true
    )

  const select = (id: string) => {
    setOpenId(id)
    const params = new URLSearchParams(search.toString())
    params.set("id", id)
    router.replace(`/admin/tickets?${params.toString()}`, { scroll: false })
  }

  const closeDrawer = (open: boolean) => {
    if (open) return
    setOpenId(null)
    const params = new URLSearchParams(search.toString())
    params.delete("id")
    const qs = params.toString()
    router.replace(qs ? `/admin/tickets?${qs}` : `/admin/tickets`, { scroll: false })
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Tickets"
        description="Customer support escalations. Click a ticket to view & resolve."
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="in_progress">In progress</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative ml-auto w-full max-w-xs">
            <HugeiconsIcon
              icon={Search01Icon}
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tickets…"
              className="h-9 pl-9"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <TicketTable tickets={filtered} isLoading={isLoading} onSelect={select} />
        </div>
      </div>

      <TicketDrawer ticketId={openId} open={!!openId} onOpenChange={closeDrawer} />
    </div>
  )
}

export default function TicketsPage() {
  return (
    <Suspense fallback={null}>
      <TicketsPageInner />
    </Suspense>
  )
}
