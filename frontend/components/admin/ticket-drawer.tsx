"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar01Icon,
  IdIcon,
  UserIcon,
  Mail01Icon,
  CallIcon,
} from "@hugeicons/core-free-icons"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { TicketStatusBadge } from "./ticket-status-badge"
import { TicketConversation } from "./ticket-conversation"
import { ResolveForm } from "./resolve-form"
import { useTicket } from "@/hooks/use-tickets"

type Props = {
  ticketId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TicketDrawer({ ticketId, open, onOpenChange }: Props) {
  const { data: ticket, isLoading } = useTicket(open ? ticketId : null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="space-y-2 border-b border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="line-clamp-2 text-base">
              {ticket?.query_summary ?? "Ticket details"}
            </SheetTitle>
            {ticket && <TicketStatusBadge status={ticket.status} />}
          </div>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {ticket && (
                <>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <HugeiconsIcon icon={IdIcon} size={12} />
                    {ticket.id.slice(0, 12)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={Calendar01Icon} size={12} />
                    {new Date(ticket.created_at).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 p-5">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {ticket && (
            <>
              {ticket.customer_name && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer Info
                  </h3>
                  <div className="space-y-1.5 rounded-lg border border-border bg-card p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon
                        icon={UserIcon}
                        size={14}
                        className="text-muted-foreground"
                      />
                      <span>{ticket.customer_name}</span>
                    </div>
                    {ticket.customer_email && (
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon
                          icon={Mail01Icon}
                          size={14}
                          className="text-muted-foreground"
                        />
                        <span>{ticket.customer_email}</span>
                      </div>
                    )}
                    {ticket.customer_phone ? (
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon
                          icon={CallIcon}
                          size={14}
                          className="text-muted-foreground"
                        />
                        <span>{ticket.customer_phone}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon
                          icon={CallIcon}
                          size={14}
                          className="text-muted-foreground"
                        />
                        <span className="text-muted-foreground">—</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {ticket.additional_details && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Additional Details
                  </h3>
                  <div className="whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 text-sm leading-relaxed">
                    {ticket.additional_details}
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Conversation
                </h3>
                <TicketConversation messages={ticket.conversation} />
              </section>

              <Separator />

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Resolve
                </h3>
                <ResolveForm ticket={ticket} />
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
