# CLAUDE.md

Project context for Claude Code. Read this before touching any file.

---

## What This Is

AI-powered customer support system for a health insurance company. Express backend + Next.js frontend. One agent, one tool (`smart_search`), four DB tables. The guardrail on KB-first vs web-fallback is enforced in code via a Haiku confidence score not via prompt instruction.

Assessment project for DevX Labs. Time-boxed. Prioritise working demo over perfection.

---

## Monorepo Layout

```
/backend   ← Bun + Express + TypeScript
/frontend  ← Next.js 14 App Router + TypeScript
```

Each has its own `package.json`. Run separately. Backend default port: 3001. Frontend: 3000.

---

## Backend Conventions (non-negotiable)

- **Functions:** `snake_case` `search_kb`, `create_ticket`, `score_kb_results`
- **Types:** `T<CamelCase>` prefix `TMessage`, `TTicket`, `TKBEntry`, `TSearchRecord`, `TAgentResponse`
- **Files:** `kebab-case` `kb-service.ts`, `ticket-controller.ts`, `score-utils.ts`
- **Env:** Bun native `Bun.env.ANTHROPIC_API_KEY` (never `process.env`)
- **DB client:** Prisma singleton via `globalThis.__prisma` in `src/db/client.ts`

---

## Key Files

| File | What it does |
|---|---|
| `backend/src/services/agent-service.ts` | Orchestrates Claude + smart_search tool. The brain. |
| `backend/src/services/kb-service.ts` | Tag + keyword scoring search over kb_entries table |
| `backend/src/services/score-service.ts` | Haiku call to score KB relevance 0–10, returns 0–1 confidence |
| `backend/src/services/search-service.ts` | Web search via Claude tool + health-insurance guardrail |
| `backend/src/services/ticket-service.ts` | Create, list, resolve tickets |
| `backend/src/services/summarise-service.ts` | claude-haiku-4-5-20251001 call to generate KB-ready Q&A from resolved ticket |
| `backend/src/constants/prompts.ts` | ALL system prompts live here. Never inline prompts in service files. |
| `backend/src/constants/tags.ts` | `APPROVED_TAGS` array the only valid KB tags |
| `backend/src/constants/thresholds.ts` | `KB_CONFIDENCE_THRESHOLD = 0.6`, `WEB_CONFIDENCE_FLOOR = 0.5` |
| `backend/data/kb.json` | Source of truth for KB seed data |
| `backend/prisma/schema.prisma` | 4 models: KbEntry, Message, SearchResult, Ticket |
| `frontend/components/chat/SourceBadge.tsx` | Renders "From KB" / "From Web" / "Aarogya" badge |
| `frontend/components/chat/ConfidencePill.tsx` | Renders "KB match: 84%" only shown when source = "kb" |

---

## The ONE Tool: smart_search

The agent has exactly one tool. Do not add more tools without discussion.

```typescript
smart_search({
  query: string,      // user's question verbatim
  tags: string[]      // 1–3 tags from APPROVED_TAGS
})
```

Internally, `smart_search` in `agent-service.ts`:
1. Calls `kb-service.search_kb(query, tags)` → top 3 KB entries by raw score
2. Calls `score-service.score_kb_results(query, entries)` → Haiku scores relevance 0–10
3. If confidence ≥ 0.6 → returns KB result with `source: "kb"`
4. If confidence < 0.6 → calls `search-service.web_search(query)` → returns with `source: "web"`

The fallback decision is made in TypeScript, not by Claude. Claude only receives the final result.

---

## Models

- Main agent: `claude-haiku-4-5-20251001`
- Confidence scorer + guardrail: `claude-haiku-4-5-20251001`
- Resolution summariser: `claude-haiku-4-5-20251001`

Never swap models without updating this file.

---

## DB Tables Summary

```
kb_entries    knowledge base, seeded from data/kb.json
messages      every chat message with source metadata on assistant turns
search_results every KB and web search performed (audit trail)
tickets       support tickets, full conversation stored as JSON
```

After any Prisma schema change: `bunx prisma migrate dev --name <description>`
After pulling: `bunx prisma generate`

---

## SSE Streaming Format

`POST /api/chat` streams SSE. The frontend must handle:

```
event: delta        ← append text to current message
event: metadata     ← parse JSON, attach to current message: { source, confidence_score, kb_entry_id?, web_source_url? }
event: done         ← finalise current message
```

Never put metadata inside delta events. Always a separate metadata event.

---

## Source Values

`TMessageSource = "kb" | "web" | "ai"`

- `"kb"` answered from KB, confidence ≥ 0.6
- `"web"` KB confidence < 0.6, web search used
- `"ai"` fallback: no tool results available, Claude answered from general knowledge

---

## What NOT to Do

- Do not use any model other than those listed above
- Do not give the agent more than one tool
- Do not put decision logic (KB vs web) in the system prompt it lives in `agent-service.ts`
- Do not hardcode API keys anywhere
- Do not use `process.env` in the backend use `Bun.env`
- Do not use `any` type use `unknown` and narrow
- Do not inline system prompts in service files all prompts go in `constants/prompts.ts`
- Do not add KB tags outside of `APPROVED_TAGS`
- Do not use vector DB or embeddings out of scope for this build
- Do not add new shadcn/ui components manually use `npx shadcn@latest add <name>`

---


 agent-log File rule:
log ur every action, with reasoning there.. with this format - 
IST_TIMESTAMP : ur action in 1-2 lines