"use client"

import { PageHeader } from "@/components/admin/page-header"
import { GroundingSettings } from "@/components/admin/grounding-settings"

export default function AdminSettingsPage() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Settings"
        description="Configure web search grounding and other preferences."
      />
      <GroundingSettings />
    </div>
  )
}
