"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Stethoscope02Icon,
  HealthIcon,
  Shield01Icon,
  HospitalLocationIcon,
} from "@hugeicons/core-free-icons"

type Props = {
  onPick: (text: string) => void
}

const SUGGESTIONS: { icon: typeof HealthIcon; label: string; prompt: string }[] = [
  {
    icon: Shield01Icon,
    label: "What's my deductible?",
    prompt: "What is my annual deductible?",
  },
  {
    icon: HospitalLocationIcon,
    label: "Cashless hospitalisation",
    prompt: "How does cashless hospitalisation work at network hospitals?",
  },
  {
    icon: HealthIcon,
    label: "Is physiotherapy covered?",
    prompt: "Is physiotherapy covered under my plan?",
  },
  {
    icon: Stethoscope02Icon,
    label: "How do I file a claim?",
    prompt: "How do I file a claim for a hospital bill?",
  },
]

export function EmptyState({ onPick }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <HugeiconsIcon icon={Stethoscope02Icon} size={26} strokeWidth={1.6} />
      </div>
      <div className="max-w-md space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Welcome to InsureCo Support
        </h2>
        <p className="text-sm text-muted-foreground">
          Ask anything about your health insurance claims, coverage, network
          hospitals, or how to file a request. Grounded in your policy.
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onPick(s.prompt)}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-sm transition-all hover:border-primary/40 hover:bg-accent hover:shadow-sm"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15">
              <HugeiconsIcon icon={s.icon} size={16} strokeWidth={1.8} />
            </span>
            <span className="font-medium text-foreground">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
