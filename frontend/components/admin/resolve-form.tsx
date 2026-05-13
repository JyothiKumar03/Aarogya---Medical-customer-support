"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useResolveTicket } from "@/hooks/use-tickets"
import type { TTicket } from "@/types"

type Props = {
  ticket: TTicket
}

export function ResolveForm({ ticket }: Props) {
  const [notes, setNotes] = useState(ticket.resolution_notes ?? "")
  const [addToKB, setAddToKB] = useState(true)
  const resolve = useResolveTicket()

  const submit = async () => {
    if (!notes.trim()) {
      toast.error("Please write resolution notes before resolving.")
      return
    }
    try {
      const updated = await resolve.mutateAsync({
        id: ticket.id,
        resolution_notes: notes.trim(),
        add_to_kb: addToKB,
      })
      toast.success(
        updated.kb_entry_id
          ? "Resolved & added to KB"
          : "Ticket resolved",
        {
          description: updated.kb_entry_id
            ? `KB entry #${updated.kb_entry_id.slice(0, 6)} created.`
            : undefined,
        }
      )
    } catch (err) {
      console.error(err)
      toast.error("Couldn't resolve ticket.")
    }
  }

  if (ticket.status === "resolved") {
    return (
      <div className="space-y-3 rounded-xl border border-success/20 bg-success/5 p-4">
        <div className="flex items-center gap-2 text-success">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} />
          <p className="text-sm font-semibold">Ticket resolved</p>
        </div>
        {ticket.resolution_notes && (
          <div className="rounded-lg bg-card p-3 text-sm leading-relaxed text-foreground">
            {ticket.resolution_notes}
          </div>
        )}
        {ticket.added_to_kb && ticket.kb_entry_id && (
          <p className="text-xs text-muted-foreground">
            Added to KB as entry{" "}
            <span className="font-mono text-foreground">
              #{ticket.kb_entry_id.slice(0, 8)}
            </span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-sm font-medium">
          Resolution notes
        </Label>
        <Textarea
          id="notes"
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What was the answer? Be specific this is what the customer (and the AI) will see going forward."
        />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-accent/40 px-3 py-2.5">
        <div>
          <Label htmlFor="add-kb" className="text-sm font-medium">
            Add to Knowledge Base
          </Label>
          <p className="text-xs text-muted-foreground">
            AI summarises this resolution into a Q&A and stores it for future queries.
          </p>
        </div>
        <Switch id="add-kb" checked={addToKB} onCheckedChange={setAddToKB} />
      </div>

      <Button
        onClick={submit}
        disabled={resolve.isPending || !notes.trim()}
        className="w-full"
      >
        {resolve.isPending ? "Resolving…" : "Resolve ticket"}
      </Button>
    </div>
  )
}
