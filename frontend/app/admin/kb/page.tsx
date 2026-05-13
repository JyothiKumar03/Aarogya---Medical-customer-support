"use client"

import { useMemo, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Book01Icon } from "@hugeicons/core-free-icons"
import { PageHeader } from "@/components/admin/page-header"
import { KBCreateDialog } from "@/components/admin/kb-create-dialog"
import { KBEntryCard } from "@/components/admin/kb-entry-card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useKB } from "@/hooks/use-kb"

type Filter = "all" | "manual" | "ticket-resolution"

export default function KBPage() {
  const { data, isLoading } = useKB()
  const [filter, setFilter] = useState<Filter>("all")
  const [q, setQ] = useState("")

  const filtered = useMemo(() => {
    return (data ?? [])
      .filter((e) => (filter === "all" ? true : e.source === filter))
      .filter((e) =>
        q.trim()
          ? `${e.title} ${e.content} ${e.tags.join(" ")}`
              .toLowerCase()
              .includes(q.toLowerCase())
          : true
      )
  }, [data, filter, q])

  return (
    <div className="min-h-full">
      <PageHeader
        title="Knowledge Base"
        description="The source of truth grounding every AI response."
        actions={<KBCreateDialog />}
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="manual">Manual</TabsTrigger>
              <TabsTrigger value="ticket-resolution">From tickets</TabsTrigger>
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
              placeholder="Search title, content, tags…"
              className="h-9 pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : !filtered.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/60 py-16 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <HugeiconsIcon icon={Book01Icon} size={18} />
            </span>
            <p className="text-sm font-medium text-foreground">No KB entries found</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Adjust filters, or add a new entry. Resolutions from tickets will appear here too.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((entry) => (
              <KBEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
