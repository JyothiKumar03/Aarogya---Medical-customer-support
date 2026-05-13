"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  GlobalSearchIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { TWebSourceLink } from "@/types"

type Props = {
  relevant?: TWebSourceLink[]
  irrelevant?: TWebSourceLink[]
}

function host_of(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function SourceRow({
  link,
  variant,
}: {
  link: TWebSourceLink
  variant: "relevant" | "irrelevant"
}) {
  const ok = variant === "relevant"
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors",
        ok ? "hover:bg-success/5" : "hover:bg-muted",
      )}
    >
      <HugeiconsIcon
        icon={ok ? CheckmarkCircle02Icon : Cancel01Icon}
        size={12}
        strokeWidth={2}
        className={cn(
          "mt-0.5 shrink-0",
          ok ? "text-success" : "text-muted-foreground",
        )}
      />
      <div className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate text-[12px] font-medium",
            ok ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {link.title || link.url}
        </span>
        <span className="truncate text-[10.5px] text-muted-foreground/80 group-hover:text-primary group-hover:underline">
          {host_of(link.url)}
        </span>
      </div>
    </a>
  )
}

export function WebSourcesDropdown({ relevant = [], irrelevant = [] }: Props) {
  const [open, set_open] = useState(false)
  const total = relevant.length + irrelevant.length

  if (total === 0) return null

  return (
    <div className="rounded-xl border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => set_open((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
          <HugeiconsIcon
            icon={GlobalSearchIcon}
            size={12}
            strokeWidth={2}
            className="text-muted-foreground"
          />
          Web sources
          <span className="ml-1 text-[10.5px] font-normal text-muted-foreground">
            {relevant.length} relevant · {irrelevant.length} filtered out
          </span>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          strokeWidth={2}
          className={cn(
            "text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/60 px-3 py-2.5">
          {relevant.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-success">
                Relevant ({relevant.length})
              </div>
              <div className="flex flex-col">
                {relevant.map((link) => (
                  <SourceRow key={link.url} link={link} variant="relevant" />
                ))}
              </div>
            </div>
          )}
          {irrelevant.length > 0 && (
            <div className="space-y-0.5">
              <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Filtered out ({irrelevant.length})
              </div>
              <p className="px-1 pb-0.5 text-[10.5px] text-muted-foreground/80">
                These hits were rejected as off-topic for your question.
              </p>
              <div className="flex flex-col">
                {irrelevant.map((link) => (
                  <SourceRow key={link.url} link={link} variant="irrelevant" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
