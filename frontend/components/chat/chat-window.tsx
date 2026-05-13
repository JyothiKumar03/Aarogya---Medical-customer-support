"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { useSession } from "@/hooks/use-session"
import { useChat } from "@/hooks/use-chat"
import { MAX_USER_MESSAGES_PER_CHAT } from "@/lib/limits"
import { Button } from "@/components/ui/button"
import { ChatHeader } from "./chat-header"
import { ChatInput } from "./chat-input"
import { MessageBubble } from "./message-bubble"
import { EmptyState } from "./empty-state"
import { TicketCTA } from "./ticket-cta"
import type { TMessage } from "@/types"

export function ChatWindow() {
  const { sessionId, rotate } = useSession()
  const {
    messages,
    isStreaming,
    userMessageCount,
    atLimit,
    send,
    stop,
    reset,
    createTicket,
    isCreatingTicket,
  } = useChat(sessionId)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [createdTicket, setCreatedTicket] = useState<string | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages])

  const handleCreateTicket = async () => {
    try {
      const res = await createTicket()
      if (res?.ticket_id) {
        setCreatedTicket(res.ticket_id)
        toast.success("Ticket created", {
          description: `#${res.ticket_id.slice(0, 8)} our team will reach out within 24 hours.`,
        })
      }
    } catch (err) {
      console.error(err)
      toast.error("Couldn't create ticket. Please try again.")
    }
  }

  const lastAssistantIdx = findLastAssistantIndex(messages)
  const showCta =
    !isStreaming &&
    lastAssistantIdx !== -1 &&
    !messages[lastAssistantIdx].pending &&
    !createdTicket

  const handleNewChat = () => {
    reset()
    rotate()
    setCreatedTicket(null)
  }

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-3xl flex-col px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <ChatHeader
          onReset={handleNewChat}
          hasMessages={messages.length > 0}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-5 sm:px-5 md:px-6">
          {messages.length === 0 ? (
            <EmptyState onPick={(t) => void send(t)} />
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((m, i) => (
                <div key={m.id} className="flex flex-col gap-2">
                  <MessageBubble message={m} />
                  {i === lastAssistantIdx && showCta && (
                    <div className="ml-11 mr-1">
                      <TicketCTA
                        onClick={handleCreateTicket}
                        loading={isCreatingTicket}
                      />
                    </div>
                  )}
                </div>
              ))}
              {createdTicket && (
                <div className="ml-11 flex items-center gap-2 rounded-xl border border-success/20 bg-success/5 px-3.5 py-2.5 text-xs text-success">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                  <span>
                    Ticket{" "}
                    <span className="font-mono font-semibold">
                      #{createdTicket.slice(0, 8)}
                    </span>{" "}
                    created. Our team will reach out within 24 hours.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card/60 px-3 py-3 sm:px-5">
          {atLimit && (
            <div className="mb-2 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex items-start gap-2">
                <HugeiconsIcon
                  icon={InformationCircleIcon}
                  size={14}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  You've reached the {MAX_USER_MESSAGES_PER_CHAT}-message limit for
                  this chat. Start a fresh one to keep going, or raise a ticket so a
                  human can pick it up.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNewChat}
                className="shrink-0"
              >
                <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={13} />
                Start new chat
              </Button>
            </div>
          )}
          <ChatInput
            onSend={send}
            onStop={stop}
            isStreaming={isStreaming}
            disabled={!sessionId || atLimit}
            placeholder={
              atLimit
                ? "Chat limit reached. Start a new chat to continue."
                : undefined
            }
          />
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            {atLimit
              ? `Limit ${MAX_USER_MESSAGES_PER_CHAT}/${MAX_USER_MESSAGES_PER_CHAT} messages used.`
              : `Responses are grounded in InsureCo's knowledge base. AI can make mistakes verify policy specifics in your member portal. (${userMessageCount}/${MAX_USER_MESSAGES_PER_CHAT})`}
          </p>
        </div>
      </div>
    </div>
  )
}

function findLastAssistantIndex(messages: TMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return i
  }
  return -1
}
