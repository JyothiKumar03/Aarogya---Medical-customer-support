export type TSearchSettings = {
  id: string
  allowed_domains: string[]
  blocked_domains: string[]
  updated_at: Date
}

export type TUpdateSearchSettingsBody = {
  allowed_domains: string[]
  blocked_domains: string[]
}
