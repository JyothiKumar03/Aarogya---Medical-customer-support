"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Doctor02Icon,
  UserCircleIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { SourceBadge } from "./source-badge"
import { ConfidencePill } from "./confidence-pill"
import { TypingIndicator } from "./typing-indicator"
import { WebSourcesDropdown } from "./web-sources-dropdown"
import type { TMessage } from "@/types"

type Props = {
  message: TMessage
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 px-1">
        <div className="max-w-[78%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm">
          {message.content}
        </div>
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
          <HugeiconsIcon icon={UserCircleIcon} size={18} strokeWidth={1.8} />
        </div>
      </div>
    )
  }

  const isEmpty = !message.content && message.pending
  const showSourceBadge =
    !message.pending && !message.errored && !!message.source
  const showConfidence =
    !message.pending &&
    !message.errored &&
    message.source === "kb" &&
    typeof message.confidence_score === "number"
  const webRelevant = message.metadata?.web_relevant_urls ?? []
  const webIrrelevant = message.metadata?.web_irrelevant_urls ?? []
  const showWebSources =
    !message.pending && !message.errored && webRelevant.length + webIrrelevant.length > 0

  return (
    <div className="flex gap-3 px-1">
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1",
          message.errored
            ? "bg-destructive/10 text-destructive ring-destructive/20"
            : "bg-primary/10 text-primary ring-primary/20"
        )}
      >
        <HugeiconsIcon
          icon={message.errored ? AlertCircleIcon : Doctor02Icon}
          size={18}
          strokeWidth={1.8}
        />
      </div>

      <div className="flex max-w-[82%] flex-col gap-1.5">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border bg-card px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            message.errored
              ? "border-destructive/20 text-destructive"
              : "border-border text-foreground"
          )}
        >
          {isEmpty ? (
            <TypingIndicator />
          ) : (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {message.pending && (
                <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-primary/60 align-middle" />
              )}
            </div>
          )}
        </div>

        {(showSourceBadge || showConfidence) && (
          <div className="flex flex-wrap items-center gap-1.5 pl-1">
            {showSourceBadge && message.source && <SourceBadge source={message.source} />}
            {showConfidence && (
              <ConfidencePill score={message.confidence_score as number} />
            )}
          </div>
        )}
        {showWebSources && (
          <WebSourcesDropdown relevant={webRelevant} irrelevant={webIrrelevant} />
        )}
      </div>
    </div>
  )
}
