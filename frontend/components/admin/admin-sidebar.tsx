"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  TicketStarIcon,
  Book01Icon,
  Stethoscope02Icon,
} from "@hugeicons/core-free-icons"
import { ViewSwitcher } from "@/components/shared/view-switcher"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  href: string
  icon: typeof DashboardSquare01Icon
  exact?: boolean
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: DashboardSquare01Icon, exact: true },
  { label: "Tickets", href: "/admin/tickets", icon: TicketStarIcon },
  { label: "Knowledge Base", href: "/admin/kb", icon: Book01Icon },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-[100dvh] w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex flex-col gap-3 border-b border-sidebar-border px-4 py-4">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <HugeiconsIcon icon={Stethoscope02Icon} size={18} strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-foreground">InsureCo</p>
            <p className="text-[11px] text-muted-foreground">Admin console</p>
          </div>
        </Link>
        <ViewSwitcher active="admin" className="w-full justify-stretch [&>a]:flex-1 [&>a]:justify-center" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <HugeiconsIcon icon={item.icon} size={16} strokeWidth={1.8} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
