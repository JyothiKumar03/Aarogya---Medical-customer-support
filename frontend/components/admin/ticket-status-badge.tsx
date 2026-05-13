import { Badge } from "@/components/ui/badge"
import type { TTicketStatus } from "@/types"

const STYLES: Record<
  TTicketStatus,
  { label: string; variant: "default" | "success" | "warning" | "muted" }
> = {
  open: { label: "Open", variant: "warning" },
  in_progress: { label: "In progress", variant: "default" },
  resolved: { label: "Resolved", variant: "success" },
}

export function TicketStatusBadge({ status }: { status: TTicketStatus }) {
  const s = STYLES[status]
  return <Badge variant={s.variant}>{s.label}</Badge>
}
