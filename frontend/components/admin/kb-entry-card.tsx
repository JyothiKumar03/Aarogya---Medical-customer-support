"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  ChatAdd01Icon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TagList } from "./tag-picker"
import { useDeleteKB } from "@/hooks/use-kb"
import { formatRelativeTime } from "@/lib/utils"
import type { TKBEntry } from "@/types"

export function KBEntryCard({ entry }: { entry: TKBEntry }) {
  const [confirming, setConfirming] = useState(false)
  const del = useDeleteKB()

  const remove = async () => {
    if (!confirming) {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    try {
      await del.mutateAsync(entry.id)
      toast.success("KB entry deleted")
    } catch (err) {
      console.error(err)
      toast.error("Couldn't delete entry.")
    }
  }

  const fromTicket = entry.source === "ticket-resolution"

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-snug text-foreground">
            {entry.title}
          </h3>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono">#{entry.id.slice(0, 6)}</span>
            <span>•</span>
            <span>{formatRelativeTime(entry.created_at)}</span>
          </div>
        </div>
        <Badge variant={fromTicket ? "info" : "muted"} className="shrink-0">
          <HugeiconsIcon
            icon={fromTicket ? ChatAdd01Icon : UserEdit01Icon}
            size={11}
          />
          {fromTicket ? "From ticket" : "Manual"}
        </Badge>
      </div>

      <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {entry.content}
      </p>

      <div className="flex items-center justify-between gap-2 pt-1">
        <TagList tags={entry.tags} />
        <Button
          size="sm"
          variant={confirming ? "destructive" : "ghost"}
          onClick={remove}
          disabled={del.isPending}
          className="shrink-0"
        >
          <HugeiconsIcon icon={Delete02Icon} size={13} />
          {confirming ? "Confirm" : "Delete"}
        </Button>
      </div>
    </article>
  )
}
