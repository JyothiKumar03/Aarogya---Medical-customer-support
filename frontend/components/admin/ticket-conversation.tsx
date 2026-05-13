"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Doctor02Icon, UserCircleIcon } from "@hugeicons/core-free-icons"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { SourceBadge } from "@/components/chat/source-badge"
import { ConfidencePill } from "@/components/chat/confidence-pill"
import { cn } from "@/lib/utils"
import type { TMessage } from "@/types"

export function TicketConversation({ messages }: { messages: TMessage[] }) {
  if (!messages.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No messages in this conversation.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "flex gap-2.5",
            m.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          {m.role === "assistant" && (
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              <HugeiconsIcon icon={Doctor02Icon} size={14} />
            </div>
          )}
          <div className="flex max-w-[80%] flex-col gap-1">
            <div
              className={cn(
                "rounded-xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "rounded-tr-sm bg-primary text-primary-foreground"
                  : "rounded-tl-sm border border-border bg-card text-foreground"
              )}
            >
              {m.role === "assistant" ? (
                <div className="prose-chat">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
            </div>
            {m.role === "assistant" && (m.source || typeof m.confidence_score === "number") && (
              <div className="flex flex-wrap items-center gap-1.5">
                {m.source && <SourceBadge source={m.source} />}
                {m.source === "kb" && typeof m.confidence_score === "number" && (
                  <ConfidencePill score={m.confidence_score} />
                )}
              </div>
            )}
          </div>
          {m.role === "user" && (
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
              <HugeiconsIcon icon={UserCircleIcon} size={14} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
