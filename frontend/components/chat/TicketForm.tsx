"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { TMessage } from "@/types"

type TTicketFormProps = {
  session_id: string
  conversation_history: TMessage[]
  on_cancel: () => void
  on_success: (ticket_id: string, email: string) => void
}

export function TicketForm({
  session_id,
  conversation_history,
  on_cancel,
  on_success,
}: TTicketFormProps) {
  const [name, set_name] = useState("")
  const [email, set_email] = useState("")
  const [phone, set_phone] = useState("")
  const [details, set_details] = useState("")
  const [loading, set_loading] = useState(false)
  const [error, set_error] = useState<string | null>(null)
  const [success, set_success] = useState<{
    ticket_id: string
    email: string
  } | null>(null)

  async function handle_submit() {
    if (!name.trim()) {
      set_error("Name is required")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      set_error("Enter a valid email")
      return
    }
    if (phone.trim() && !/^\d{10}$/.test(phone.trim())) {
      set_error("Phone must be 10 digits")
      return
    }

    set_loading(true)
    set_error(null)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api"}/tickets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id,
            conversation_history,
            customer_name: name.trim(),
            customer_email: email.trim(),
            customer_phone: phone.trim() || undefined,
            additional_details: details.trim() || undefined,
          }),
        }
      )

      if (!res.ok) {
        set_loading(false)
        set_error("Something went wrong. Please try again.")
        return
      }

      const data = await res.json()
      set_success({ ticket_id: data.ticket_id, email })
      on_success(data.ticket_id, email)
    } catch {
      set_loading(false)
      set_error("Something went wrong. Please try again.")
    }
  }

  if (success) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm">
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          size={16}
          className="mt-0.5 shrink-0 text-success"
        />
        <div>
          <p className="font-medium text-success">
            Ticket #{success.ticket_id.slice(0, 8)} created.
          </p>
          <p className="mt-0.5 text-muted-foreground">
            A confirmation has been sent to {success.email}. Our team will respond
            within 24 hours.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Create a support ticket
      </p>

      <div className="space-y-3">
        <div>
          <Label htmlFor="tf-name" className="text-xs">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tf-name"
            value={name}
            onChange={(e) => set_name(e.target.value)}
            placeholder="Your name"
            className="h-9 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="tf-email" className="text-xs">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tf-email"
            type="email"
            value={email}
            onChange={(e) => set_email(e.target.value)}
            placeholder="you@example.com"
            className="h-9 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="tf-phone" className="text-xs">
            Phone number <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="tf-phone"
            type="tel"
            value={phone}
            onChange={(e) => set_phone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="9876543210"
            className="h-9 mt-1"
          />
        </div>

        <div>
          <Label htmlFor="tf-details" className="text-xs">
            Additional details{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="tf-details"
            value={details}
            onChange={(e) => set_details(e.target.value)}
            placeholder="Anything else we should know?"
            rows={2}
            className="mt-1"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handle_submit}
            disabled={loading}
            size="sm"
            className="flex-1"
          >
            {loading ? "Submitting…" : "Submit Ticket"}
          </Button>
          <Button
            onClick={on_cancel}
            variant="ghost"
            size="sm"
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
