"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { APPROVED_TAGS, type TKBTag } from "@/lib/tags"

type Props = {
  selected: TKBTag[]
  onChange: (next: TKBTag[]) => void
  max?: number
}

export function TagPicker({ selected, onChange, max = 5 }: Props) {
  const toggle = (tag: TKBTag) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag))
    } else if (selected.length < max) {
      onChange([...selected, tag])
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {APPROVED_TAGS.map((tag) => {
        const active = selected.includes(tag)
        return (
          <button
            type="button"
            key={tag}
            onClick={() => toggle(tag)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ring-1 ring-inset",
              active
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-background text-muted-foreground ring-border hover:bg-accent hover:text-foreground"
            )}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}

export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  if (!tags.length) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((t) => (
        <Badge key={t} variant="muted" className="font-normal">
          {t}
        </Badge>
      ))}
    </div>
  )
}
