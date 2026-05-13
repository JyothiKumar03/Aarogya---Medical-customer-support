"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Stethoscope02Icon,
  ArrowReloadHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { ViewSwitcher } from "@/components/shared/view-switcher"

type Props = {
  onReset: () => void
  hasMessages: boolean
}

export function ChatHeader({ onReset, hasMessages }: Props) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <HugeiconsIcon icon={Stethoscope02Icon} size={18} strokeWidth={2} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">InsureCo Support</p>
          <p className="text-[11px] text-muted-foreground">
            AI assistant • grounded in your policy
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasMessages && (
          <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
            <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={14} />
            New chat
          </Button>
        )}
        <ViewSwitcher active="user" />
      </div>
    </header>
  )
}
