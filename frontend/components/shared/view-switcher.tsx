"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon, Shield01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

type View = "user" | "admin"

type Props = {
  active: View
  className?: string
}

export function ViewSwitcher({ active, className }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Switch view"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5",
        className
      )}
    >
      <Tab
        href="/"
        label="User"
        icon={UserIcon}
        active={active === "user"}
      />
      <Tab
        href="/admin"
        label="Admin"
        icon={Shield01Icon}
        active={active === "admin"}
      />
    </div>
  )
}

function Tab({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: typeof UserIcon
  active: boolean
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <HugeiconsIcon icon={icon} size={13} strokeWidth={2} />
      {label}
    </Link>
  )
}
