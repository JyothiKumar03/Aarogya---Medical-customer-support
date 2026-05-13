# Architecture AI-Powered Health Insurance Support System

## System Overview

A decoupled Express (backend) + Next.js (frontend) platform for a health insurance company's customer support. One AI agent (Aarogya) handles the full conversation lifecycle: replies conversationally to small-talk, calls a single `smart_search` tool for genuine health-insurance questions, and politely declines off-topic. The tool runs a pgvector RAG over a tag-filtered knowledge base (cosine similarity, top-K = 5, floor = 0.3), then a small LLM judge scores answerability of the retrieved context from 0–1; below `KB_CONFIDENCE_THRESHOLD = 0.6` the system falls back to a guardrailed Tavily web search whose top-5 hits are passed through a second LLM that classifies every URL as relevant or irrelevant and writes a neutral fact digest (third-person, no advice, no second-person language) the main agent quotes from to compose the final reply. **Web search is restricted to admin-curated domains** held in a `SearchSettings` row (`allowed_domains` + `blocked_domains`, edited from `/admin/settings`) and pushed into Tavily's `includeDomains` / `excludeDomains`. At chat-time the active domain list is also injected into the main agent's system prompt and the `smart_search` tool description as a "grounding context" block so the LLM frames its query around the brand behind those domains and never leaks the internal persona name into the web call. The KB judge and the web guardrail share a dedicated provider chain (OpenAI primary, Gemini fallback) so the main agent's model preference does not bias retrieval gating. If the customer is still unsatisfied the conversation can be escalated to a ticket the ticket form captures `customer_name`, `customer_email`, `customer_phone` and a Resend-powered transactional email goes out on creation. When the admin resolves it, a second branded email ships with the admin's notes verbatim, and resolved tickets optionally feed a Claude-generated summary back into the KB closing the self-improvement loop.

---

## Stack

| Layer | Choice |
|---|---|
| Backend runtime | Bun |
| Backend framework | Express + TypeScript |
| Frontend | Next.js 14, App Router, TypeScript |
| LLM main agent | Anthropic `claude-haiku-4-5-20251001` via Vercel AI SDK `streamText` (maxSteps: 2 one tool round-trip). Falls back through `build_providers()` chain. |
| LLM check chain (KB judge + web guardrail) | OpenAI `gpt-4.1-mini` primary, Gemini `gemini-2.0-flash` fallback (see `build_check_providers()` in `ai-service.ts`). Anthropic is intentionally excluded so the main agent's vendor cannot bias retrieval gating. |
| LLM main-agent fallback providers | OpenAI `gpt-4.1-mini`, Anthropic `claude-haiku-4-5-20251001`, Gemini `gemini-2.0-flash` (chained in `ai-service.ts` via `build_providers()`) |
| LLM resolution summariser + ticket summariser | `build_providers()` chain (any of the three) via `generateObject` with Zod schemas |
| Embeddings | OpenAI `text-embedding-3-small` (256-dim) used for RAG and KB ingest |
| Vector store | PostgreSQL (Neon) + pgvector extension column `embedding vector(256)` on `KbEntry`; cosine distance operator `<=>` |
| Web search | Tavily SDK (`@tavily/core`) top-5 results with admin-curated `includeDomains` / `excludeDomains`, then LLM-classified into relevant/irrelevant URLs + a neutral fact digest (no customer-facing prose, no advice). 15 s timeout, URL-normalised classification mapping. |
| Transactional email | Resend (`resend` SDK) ticket-confirmation + ticket-resolution emails. HTML templates with gradient header, status pill, detail-card layout, XSS-safe (`escape_html`) interpolation, multiline-preserving resolution field |
| DB | Prisma + PostgreSQL (Neon) |
| Frontend UI base | Vercel `ai-chatbot` template + shadcn/ui |

---

## Monorepo Structure

```
/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── chat-controller.ts
│   │   │   ├── ticket-controller.ts
│   │   │   ├── kb-controller.ts
│   │   │   └── settings-controller.ts  ← GET / PUT for SearchSettings row
│   │   ├── routes/
│   │   │   ├── chat-routes.ts
│   │   │   ├── ticket-routes.ts
│   │   │   ├── kb-routes.ts
│   │   │   └── settings-routes.ts
│   │   ├── services/
│   │   │   ├── agent-service.ts        ← orchestrates streamText + smart_search tool + decision flow; reads SearchSettings on each request and injects a dynamic "grounding block" into the system prompt + tool param description
│   │   │   ├── ai-service.ts           ← model factory + generate/stream w/ fallback + two provider chains (main vs check)
│   │   │   ├── embedding-service.ts    ← text-embedding-3-small (256-dim) wrapper
│   │   │   ├── kb-service.ts           ← pgvector RAG + SQL tag filter + KB CRUD
│   │   │   ├── score-service.ts        ← LLM judge on check-chain (user_query + tool_query + entries → confidence 0–1)
│   │   │   ├── search-service.ts       ← Tavily SDK (with allowed/blocked domain filters from SearchSettings, 15 s timeout, URL-normalised guardrail mapping) + LLM guardrail/summariser on check-chain (returns NEUTRAL fact digest + relevant_urls + irrelevant_urls + reasoning)
│   │   │   ├── settings-service.ts     ← read/write the single SearchSettings row; lazy-creates default { allowed_domains: ["prudential.com"], blocked_domains: [] } on first call
│   │   │   ├── email-service.ts        ← Resend wrapper send_ticket_confirmation + send_ticket_resolution. Shared HTML shell (gradient header, status pill, detail card, footer), escape_html-protected, multiline-aware resolution row
│   │   │   ├── ticket-service.ts       ← ticket lifecycle persists customer_name/email/phone, fires confirmation email on create and resolution email on resolve (both .catch'd so email failures never break the API)
│   │   │   ├── summarise-service.ts    ← resolution → KB summary
│   │   │   └── logger-service.ts       ← structured scoped logger
│   │   ├── db/
│   │   │   ├── client.ts               ← Prisma singleton
│   │   │   └── seed.ts                 ← seeds kb.json → DB on first run; also seeds a default SearchSettings row if none exists
│   │   ├── types/
│   │   │   ├── agent-types.ts          ← + TWebSourceLink, + web_relevant_urls / web_irrelevant_urls on TResponseMetadata
│   │   │   ├── ticket-types.ts         ← + customer_name / customer_email / customer_phone on TTicket and TCreateTicketBody
│   │   │   ├── settings-types.ts       ← TSearchSettings, TUpdateSearchSettingsBody
│   │   │   ├── kb-types.ts
│   │   │   └── search-types.ts
│   │   ├── constants/
│   │   │   ├── tags.ts                 ← approved tag list
│   │   │   ├── thresholds.ts           ← confidence cutoffs
│   │   │   └── prompts.ts              ← all system prompts in one place
│   │   ├── utils/
│   │   │   ├── score-utils.ts
│   │   │   └── format-utils.ts
│   │   └── index.ts
│   ├── data/
│   │   └── kb.json                     ← seed data
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── app/
    │   ├── page.tsx                    ← customer chat
    │   ├── admin/
    │   │   ├── page.tsx                ← admin ticket dashboard
    │   │   └── settings/page.tsx       ← web grounding (allowed / blocked domains)
    │   └── layout.tsx
    ├── hooks/
    │   ├── use-chat.ts
    │   ├── use-tickets.ts
    │   ├── use-kb.ts
    │   └── use-settings.ts             ← GET / PUT SearchSettings, local optimistic state
    ├── components/
    │   ├── chat/
    │   │   ├── chat-window.tsx
    │   │   ├── message-bubble.tsx       ← renders SourceBadge + ConfidencePill + WebSourcesDropdown
    │   │   ├── source-badge.tsx         ← "From KB" / "From Web" / "Aarogya"
    │   │   ├── confidence-pill.tsx      ← "KB match: 82%"
    │   │   ├── web-sources-dropdown.tsx ← collapsible card; two sections — Relevant + Filtered-out (per-url title + host, all open in new tab)
    │   │   ├── TicketForm.tsx           ← in-chat name / email / phone form before ticket POST
    │   │   └── ticket-cta.tsx           ← "Still need help?" button
    │   └── admin/
    │       ├── ticket-table.tsx
    │       ├── ticket-drawer.tsx
    │       ├── resolve-form.tsx         ← resolution_notes + add_to_kb toggle
    │       ├── admin-sidebar.tsx        ← Tickets / KB / Settings nav
    │       └── GroundingSettings.tsx    ← chip-style allowed/blocked domain editor + Save
    ├── lib/
    │   └── api.ts                       ← typed fetch wrappers (chat, tickets, settings)
    └── types/
        └── index.ts                     ← + TWebSourceLink, + web_relevant_urls / web_irrelevant_urls on TResponseMetadata, + TSearchSettings
```

---

## DB Schema (All 5 Tables)

### `kb_entries`
The knowledge base. Seeded from `data/kb.json`. New entries can be added via ticket resolution. Embeddings are generated via `text-embedding-3-small` (256-dim) at ingest time and stored as a native pgvector column for cosine-distance search.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `title` | `String` | Title of the KB article |
| `content` | `String` | Full content body |
| `tags` | `String` | JSON-stringified `string[]` (cast to `jsonb` at query time for tag filtering) |
| `embedding` | `Unsupported("vector(256)")?` | pgvector column. Searched via `<=>` cosine distance operator |
| `source` | `String` | `"manual"` \| `"ticket-resolution"` |
| `ticket_id` | `String?` | FK → tickets.id if from resolution loop |
| `created_at` | `DateTime @default(now())` | |
| `updated_at` | `DateTime @updatedAt` | |

### `messages`
Every message in every session. Source metadata attached to assistant turns.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `session_id` | `String` | Per-chat anonymous UUID. Stored in `insureco.session_id` in localStorage and **rotated on every "New chat"** so messages, search_results, and tickets from prior conversations don't bleed into the next one. |
| `role` | `String` | `"user"` \| `"assistant"` |
| `content` | `String` | Message text |
| `source` | `String?` | `"kb"` \| `"web"` \| `"ai"` assistant messages only |
| `confidence_score` | `Float?` | 0–1, set when source is `"kb"` |
| `kb_entry_id` | `String?` | FK → kb_entries.id when answered from KB |
| `search_result_id` | `String?` | FK → search_results.id when answered from web |
| `created_at` | `DateTime @default(now())` | |

### `search_results`
Every search performed KB lookups and web searches. Audit trail and source for messages.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `session_id` | `String` | |
| `query` | `String` | Exact query the agent passed to the tool |
| `search_type` | `String` | `"kb"` \| `"web"` |
| `results_json` | `String` | Raw results as JSON string. For web, includes both `primary` and `related[]` so the full URL list is auditable |
| `confidence_score` | `Float` | 0–1. For KB: the LLM judge's score. For web: `WEB_CONFIDENCE_FLOOR` (0.5) |
| `top_entry_id` | `String?` | FK → kb_entries.id for best KB match |
| `web_source_url` | `String?` | Primary (cited) web URL when search_type = "web". Full URL list lives in `results_json` |
| `used` | `Boolean @default(false)` | Was this result actually used in a response |
| `created_at` | `DateTime @default(now())` | |

### `tickets`
Support tickets created when user signals dissatisfaction. Full conversation stored. Customer contact fields are captured by the in-chat `TicketForm` at create time and drive the Resend email loop.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `session_id` | `String` | |
| `query_summary` | `String` | 1-line Haiku-generated summary of the user's issue |
| `conversation_json` | `String` | Full `TMessage[]` as JSON string |
| `status` | `String @default("open")` | `"open"` \| `"in_progress"` \| `"resolved"` |
| `resolution_notes` | `String?` | Written by admin. This is what gets emailed to the customer on resolve verbatim, newlines preserved. |
| `resolution_summary` | `String?` | When `add_to_kb` is true, stores the JSON-stringified KB-ready Q&A `{title, content, tags}`. Not sent in the email. |
| `added_to_kb` | `Boolean @default(false)` | Was resolution pushed to KB |
| `kb_entry_id` | `String?` | FK → kb_entries.id if added |
| `customer_name` | `String?` | Captured at create time. Required by `TicketForm` so email send has a recipient name. |
| `customer_email` | `String?` | Captured at create time. Email is only sent when both `customer_name` and `customer_email` are present. |
| `customer_phone` | `String?` | Captured at create time. Not used yet; reserved for SMS/voice followups. |
| `created_at` | `DateTime @default(now())` | |
| `updated_at` | `DateTime @updatedAt` | |

### `search_settings`
A single-row table holding the active web-grounding configuration. Lazy-created with `{ allowed_domains: ["prudential.com"], blocked_domains: [] }` on first read (or seeded by `seed.ts`). Edited from `/admin/settings` via PUT `/api/settings`. Read on every chat request to inject the grounding block into the agent's system prompt and to set Tavily's `includeDomains` / `excludeDomains`.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | Only ever one row in practice |
| `allowed_domains` | `String @default("[\"prudential.com\"]")` | JSON-stringified `string[]`. Empty array → no restriction (open web). |
| `blocked_domains` | `String @default("[]")` | JSON-stringified `string[]`. Empty array → no exclusions. |
| `updated_at` | `DateTime @updatedAt` | |

---

## Types (backend/src/types/)

```typescript
// kb-types.ts
type TKBEntry = {
  id: string
  title: string
  content: string
  tags: string[]
  embedding?: number[]     // 256-dim vector
  source: "manual" | "ticket-resolution"
  ticket_id?: string
  created_at: Date
}

type TKBSearchResult = {
  entry: TKBEntry
  raw_score: number        // cosine similarity × 100
  confidence: number       // 0–1, cosine similarity
}

// agent-types.ts
type TMessageSource = "kb" | "web" | "ai"

type TMessage = {
  id: string
  session_id: string
  role: "user" | "assistant"
  content: string
  source?: TMessageSource
  confidence_score?: number
  metadata?: TResponseMetadata
}

type TWebSourceLink = {
  url: string
  title: string
}

type TResponseMetadata = {
  source: TMessageSource
  confidence_score?: number          // For "kb": LLM judge confidence. For "web": WEB_CONFIDENCE_FLOOR. For "ai": 0
  kb_entry_id?: string
  web_source_url?: string            // primary (cited) URL
  web_source_urls?: string[]         // legacy: primary + all related URLs (kept for backwards compat)
  web_relevant_urls?: TWebSourceLink[]   // URLs the guardrail kept (title + url)
  web_irrelevant_urls?: TWebSourceLink[] // URLs the guardrail rejected; still surfaced to the UI for transparency
                                          // (also populated on the "ai" / no-relevant-hits path so the user can see
                                          //  what was searched even when the answer falls back to a generic apology)
  search_result_id?: string
}

type TAgentResponse = {
  content: string
  metadata: TResponseMetadata
}

// ticket-types.ts
type TTicketStatus = "open" | "in_progress" | "resolved"

type TTicket = {
  id: string
  session_id: string
  query_summary: string
  conversation: TMessage[]
  status: TTicketStatus
  resolution_notes?: string
  resolution_summary?: string
  added_to_kb: boolean
  kb_entry_id?: string
  customer_name?: string
  customer_email?: string
  customer_phone?: string
  created_at: Date
  updated_at: Date
}

// settings-types.ts
type TSearchSettings = {
  id: string
  allowed_domains: string[]   // includeDomains for Tavily; brand context for the agent prompt
  blocked_domains: string[]   // excludeDomains for Tavily
  updated_at: Date
}

type TUpdateSearchSettingsBody = {
  allowed_domains: string[]
  blocked_domains: string[]
}

// search-types.ts
type TSearchType = "kb" | "web"

type TSearchRecord = {
  id: string
  session_id: string
  query: string
  search_type: TSearchType
  results: unknown[]
  confidence_score: number
  top_entry_id?: string
  web_source_url?: string
  used: boolean
  created_at: Date
}
```

---

## The Escalation Flow Step by Step

This is the exact sequence for every user message.

```
1.  User sends message
        │
        ▼
2.  POST /api/chat  { session_id, message, conversation_history }
        │
        ▼
3.  chat-controller saves the user TMessage and invokes agent-service
        │
        ▼
4.  agent-service first reads the SearchSettings row (one cheap SELECT). It
    derives:
      - allowed_domains  : drives Tavily includeDomains AND the prompt brand-frame
      - blocked_domains  : drives Tavily excludeDomains
    A "grounding context" block is appended to the base AGENT_SYSTEM_PROMPT:
        "Web search is restricted to: <allowed_domains>.
         When you call smart_search:
         - Frame the 'query' for the brand behind those domains
           (prudential.com → 'Prudential', etc.)
         - DO NOT include 'InsureCo' (internal persona, zero public-web presence)
         - DO NOT invent competitor insurer names."
    The same anti-leak wording is also stamped into the smart_search 'query'
    parameter's z.string().describe(...) text so it shows up at the schema
    level next to the field the LLM is filling.

    If allowed_domains is empty, the grounding block is omitted (open-web mode).

    agent-service then runs Vercel AI SDK streamText with:
    - system prompt   (AGENT_SYSTEM_PROMPT + grounding block)
    - full conversation history
    - ONE tool: smart_search   (with dynamic 'query' param description)
    - maxSteps: 2              (cap on one tool round-trip)
    - onFinish: idempotent fallback that resolves the metadata promise
                 to { source: "ai", confidence_score: 0 } so the SSE
                 "done" event always fires even when no tool is called
        │
        ▼
5.  Main agent decides:
        ├── Greeting / thanks / meta question  → reply directly, NO tool call → step 13
        ├── Off-topic question                 → polite decline, NO tool call → step 13
        ├── Ambiguous                          → ask one clarifying question  → step 13
        └── Genuine health-insurance question  → call smart_search({ query, tags })
                                                                       │
                                                                       ▼
6.  kb-service.search_kb(query, tags)
    - Generate 256-dim query embedding (text-embedding-3-small)
    - pgvector cosine search:
        SELECT ... 1 - (embedding <=> $vec) AS similarity
        WHERE embedding IS NOT NULL
          AND (tags overlap valid_tags, applied in SQL via jsonb)        ─┐
          AND 1 - (embedding <=> $vec) > EMBEDDING_SIMILARITY_THRESHOLD   │
        ORDER BY similarity DESC                                          │
        LIMIT KB_RAG_TOP_K   (= 5)                                        │
    - Fallback: if the tagged query returned 0 rows, retry without ──────┘
      the tag filter so a bad tag pick from the LLM doesn't kill recall.
        │
        ▼
7.  Branch on retrieval size:
        ├── kb_results.length === 0  →  SKIP the scorer (no point spending
        │                               LLM tokens on zero entries); go to step 9.
        │
        └── kb_results.length > 0    →  step 8.
        │
        ▼
8.  score-service.score_kb_results(user_query, tool_query, entries)
    - LLM judge (Haiku) reads the user's verbatim question, the agent's
      tool query, and the candidate entries
    - Returns { confidence: 0–1, best_entry_index, reasoning }
    - Judges *answerability*, not topical overlap
        │
        ▼
9.  Decision gate:
        ├── kb_results.length > 0 AND confidence ≥ KB_CONFIDENCE_THRESHOLD (0.6)
        │   → KB path:
        │     - Save row to `search_results` (search_type: "kb",
        │       confidence: <judge confidence>, top_entry_id, used: true)
        │     - Return to main agent:
        │       { found: true, source: "kb", confidence, entries: [best] }
        │     - Resolve metadata { source: "kb", confidence_score, kb_entry_id, search_result_id }
        │
        └── Otherwise (no hits OR confidence < 0.6) → web fallback:
              search-service.web_search(query)
              - Reads SearchSettings (with safe defaults if DB blip)
              - Tavily SDK (@tavily/core), maxResults: 5, searchDepth: "advanced",
                  includeDomains: allowed_domains.length > 0 ? allowed_domains : undefined
                  excludeDomains: blocked_domains.length > 0 ? blocked_domains : undefined
                  (empty arrays are coerced to undefined Tavily treats `[]` as
                   "restrict to zero domains" in some versions)
              - 15 s timeout wraps the Tavily call; on timeout or any other
                Tavily error → log.warn + return { found: false }
              - If TAVILY_API_KEY is unset → early-return { found: false }
                with a clear log line
              - Guardrail + summariser LLM (check-chain: OpenAI primary,
                Gemini fallback) reads ALL 5 hits and the user query, and
                returns a single structured object:
                  {
                    final_summarized_output: string,   // NEUTRAL fact digest, 2–5
                                                       // third-person sentences,
                                                       // no advice, no second-person,
                                                       // attributes per source when
                                                       // a claim is source-specific,
                                                       // preserves source qualifiers
                                                       // ("subject to underwriting", etc.)
                    relevant_urls:    string[],        // URLs that helped
                    irrelevant_urls:  string[],        // URLs rejected as off-topic
                    reasoning:        string
                  }
              - The LLM's URL strings are matched back to the original Tavily
                hits via `normalise_url()` (host lowercased, `www.` stripped,
                trailing slash removed, scheme dropped) so minor rewrites by
                the LLM don't silently drop hits. De-duped per list.
              - If relevant_urls is empty → treated as a web miss, but
                irrelevant_urls is still returned for transparency.
              - Otherwise return:
                  { found: true, summary, relevant_urls[], irrelevant_urls[], reasoning }
                    │
                    ▼
              On web hit:
                - Save `search_results` (search_type: "web",
                  confidence: WEB_CONFIDENCE_FLOOR,
                  web_source_url: relevant_urls[0].url,
                  used: true; full payload in results_json incl. irrelevant_urls)
                - Return to main agent:
                  { found: true, source: "web", summary, relevant_urls, disclaimer }
                - Resolve metadata {
                    source: "web",
                    confidence_score,
                    web_source_url,
                    web_source_urls,
                    web_relevant_urls:    TWebSourceLink[],  // {url, title}
                    web_irrelevant_urls:  TWebSourceLink[],  // {url, title}
                    search_result_id
                  }
                    │
              On web miss:
                - Resolve metadata {
                    source: "ai",
                    confidence_score: 0,
                    web_irrelevant_urls?: TWebSourceLink[]   // surface what was
                                                              // searched, so the UI
                                                              // can show "we did look
                                                              // — here's what got
                                                              // rejected"
                  }
                - Return { found: false, source: "ai", reason }
        │
        ▼
10. Main agent composes the user-facing answer grounded in the tool result
    (or, in the no-tool-call branch, answers directly). For source = "web",
    the agent quotes from `summary` (the neutral fact digest) rather than
    reading raw web content the heavy lifting (classification + neutral
    synthesis) already happened in the guardrail/summariser step. The
    agent owns the customer-facing voice and the disclaimer.
        │
        ▼
11. For web answers: the streamed answer ends with a "Sources:" footer that
    lists every entry in `relevant_urls` as a *numbered title-only* line
    ("[1] <title>", "[2] <title>"). URLs are intentionally NOT inlined the
    UI renders clickable sources separately. Both the relevant AND irrelevant
    URLs are sent on the SSE metadata event and surfaced in a collapsible
    "Web sources" dropdown below the message bubble (relevant section in
    green w/ checkmarks; filtered-out section in muted with cancel-icons +
    short note explaining the rejection).
        │
        ▼
12. chat-controller persists the assistant TMessage with metadata.
        │
        ▼
13. SSE stream to frontend:
    - event: delta     (text chunks)
    - event: metadata  ({ source, confidence_score, kb_entry_id?,
                          web_source_url?, web_source_urls?,
                          web_relevant_urls?, web_irrelevant_urls?,
                          search_result_id? })
    - event: done
        │
        ▼
14. UI renders:
    - Message bubble (assistant text streams in token-by-token)
    - SourceBadge: "Answered from KB" (green) | "Answered from Web" (amber) | "Aarogya" (gray)
    - ConfidencePill: "KB match: 82%" only when source = "kb"
    - WebSourcesDropdown: collapsible card, only when any URL is present.
        Header chip: "Web sources · N relevant · M filtered out"
        On expand: two sections (Relevant ✓ in green, Filtered out ✗ in muted)
        with per-row title + host (e.g. "[PDF] GI Critical Illness Summary
        / web.prudential.com"), each opens in a new tab.
    - TicketCTA: "Still need help? → Create a ticket"
        → opens TicketForm (name / email / phone) inline below the message
```

---

## Retrieval Two-Stage Design

Retrieval is a **two-stage** pipeline: a cheap pgvector recall pass, followed by an LLM-judge precision pass.

### Stage 1 pgvector recall (`kb-service.search_kb`)

- Embed the query with `text-embedding-3-small` (256-dim).
- Run cosine distance against `KbEntry.embedding` using pgvector's `<=>` operator.
- Tag filter applied **in SQL** via `jsonb_array_elements_text(k.tags::jsonb)` so tag-irrelevant vector neighbours don't crowd out the top-K window.
- Floor at `EMBEDDING_SIMILARITY_THRESHOLD` (cheap noise cutoff, not the decision boundary).
- Order by similarity, `LIMIT KB_RAG_TOP_K`.
- Fallback retry without tags if the tagged query returned nothing.

### Stage 2 LLM judge (`score-service.score_kb_results`)

- Skipped entirely when stage 1 returned 0 rows.
- Takes USER_QUERY (verbatim user message) + TOOL_QUERY (the agent's reformulation) + ENTRIES.
- Runs on the **check-provider chain** (`build_check_providers()`: OpenAI primary, Gemini fallback) via `generateObject` with a Zod schema. Returns `{ confidence: 0–1, best_entry_index, reasoning }`.
- Judges whether the entries actually *answer* the question, not just topical overlap. Keyword matches without answers score < 0.3; requests for account-specific data are capped ≤ 0.3.
- The judge's `confidence` is the value compared against `KB_CONFIDENCE_THRESHOLD` and the value shown in the UI's "KB match: X%" pill.

### Web guardrail / fact extractor (`search-service.web_search`)

When KB confidence < 0.6, the system queries Tavily under the admin-curated domain filter and then runs a single LLM pass on the **check-provider chain** (OpenAI primary, Gemini fallback) that does both relevance classification and **neutral fact extraction** in one shot:

- Input: `USER_QUERY` + the 5 Tavily hits (title, url, content). Tavily call itself uses `includeDomains` / `excludeDomains` from `SearchSettings` and is wrapped in a 15 s timeout.
- Output (via `generateObject` with a Zod schema):
  ```ts
  {
    final_summarized_output: string,   // NEUTRAL fact digest, 2-5 third-person sentences,
                                       // drawn ONLY from relevant hits. No advice,
                                       // no second-person, no imperatives, no hedging,
                                       // no call-to-action, no closing disclaimer
                                       // (the main agent owns those).
                                       // Numbers / qualifiers / clause names lifted
                                       // verbatim; conflicts surfaced as both
                                       // ("Source A states X; Source B states Y").
    relevant_urls:    string[],        // URLs that genuinely answer USER_QUERY
    irrelevant_urls:  string[],        // URLs rejected as off-topic / unhelpful
    reasoning:        string
  }
  ```
- The LLM's URL strings are run through `normalise_url()` and matched back to the Tavily hit list to recover `{url, title}` pairs. Hits the LLM rewrites trivially (trailing slash, www., scheme) are still recovered. De-duped per list.
- If `relevant_urls` is empty → treated as a web miss; the irrelevant list still propagates to the UI so customers can see what was searched and why nothing was kept.
- The main agent never sees raw web content; it quotes from `final_summarized_output` and renders titles in a "Sources:" footer (numbered, title only no URLs). The clickable URL surface area lives in the dropdown UI, not in the streamed answer.

**Why "neutral fact digest" and not "answer to USER_QUERY"?** The earlier iteration had the guardrail produce a customer-facing answer, which leaked phrasing/bias/hedging into the streamed reply (since the main agent was told to "stick to what the summary says"). Splitting the work the guardrail extracts facts, the main agent composes prose keeps the customer-facing voice consistent and lets the main agent own disclaimers and tone.

**Why a separate check-provider chain?** The KB judge and the web guardrail both gate what the main agent is allowed to say. Running them on a different vendor from the main agent (OpenAI/Gemini vs Anthropic for the main agent) means a quirk in one vendor's instruction-following can't simultaneously bias retrieval gating *and* answer composition.

**Why admin-curated domains and not free Tavily?** The brief asked for "curated grounding" rather than a KB update. With a free Tavily call the system would surface anything topical (random hospital ads, news, lifestyle blogs). With `allowed_domains: ["prudential.com"]` we restrict the search surface to a known-trustworthy publisher and the dynamic prompt block tells the agent to frame its query around that brand, so "claim settlement ratio for my plan" doesn't get rewritten into a confused multi-brand search. An admin can add `irdai.gov.in`, `policybazaar.com`, etc. at any time from `/admin/settings`; the next chat request rebinds immediately (no caching, single SELECT).

### Embedding function (`services/embedding-service.ts`)

```typescript
// Generic used in both seed.ts (ingest) and kb-service.ts (RAG)
await generate_embedding(text)  // → number[256]
```

### Thresholds (`constants/thresholds.ts`)

```typescript
export const EMBEDDING_SIMILARITY_THRESHOLD = 0.3  // stage-1 noise floor (pgvector recall)
export const KB_CONFIDENCE_THRESHOLD        = 0.6  // stage-2 decision boundary (LLM judge)
export const WEB_CONFIDENCE_FLOOR           = 0.5  // fixed score persisted for web answers
export const KB_RAG_TOP_K                   = 5    // pgvector limit
```

**Why two thresholds?** Cosine similarity ≈ topical proximity; LLM judge ≈ answerability. Two entries can be 0.65-similar yet neither one actually answers the question. The judge is the gate; the cosine floor is just hygiene to keep noise out of the LLM's context.

---

## Ticket Creation Flow

```
User clicks "Still need help?"
        │
        ▼
TicketForm appears inline below the message bubble
  - name      (required)
  - email     (required, email-pattern validated)
  - phone     (required, captured for future SMS/voice followups)
        │
        ▼
POST /api/tickets
Body: { session_id, conversation_history: TMessage[],
        customer_name, customer_email, customer_phone }
        │
        ▼
ticket-service.create_ticket():
  1. LLM call: generate query_summary from last 3 user messages (1 sentence max)
  2. INSERT ticket row (status: "open", conversation_json: serialised history,
                        customer_name / email / phone persisted)
  3. Fire-and-forget: send_ticket_confirmation({ to, customer_name, ticket_id,
                                                 query_summary })
       - Resend SDK; HTML built from the shared `shell()` template
         (gradient header, status pill "Open" blue, detail card, footer)
       - Subject: "We've got your request #ABC12345"
       - Preheader: "Ticket #ABC12345 received we'll respond within 24 hours."
       - All user-supplied fields escape_html'd
       - `.catch(err => log.error(...))` so an email send failure NEVER
         breaks the ticket POST
  4. Return { ticket_id, status: "open", query_summary }
        │
        ▼
UI: toast "Ticket created — confirmation sent to <email>. Our team will reach
     out within 24 hours."
     Inline ticket-id banner stays under the message bubble.
```

---

## Ticket Resolution → KB Feedback Loop

```
Admin opens ticket → writes resolution_notes → toggles "Add to KB" → clicks Resolve
        │
        ▼
PATCH /api/tickets/:id
Body: { resolution_notes: string, add_to_kb: boolean }
        │
        ▼
ticket-service.resolve_ticket():
  1. UPDATE ticket: status → "resolved", resolution_notes saved
  2. If add_to_kb = true:
       - Call summarise-service.generate_resolution_summary(conversation, notes)
              │
              └── claude-haiku-4-5-20251001 call:
                  "Given this support conversation and the agent's resolution notes,
                   produce a KB entry. Return ONLY valid JSON:
                   { title: string, content: string, tags: string[] }
                   Tags must be from the approved list only.
                   Answer must be 2–3 sentences, factual, no first-person pronouns."
              │
              └── Parse JSON, validate tags against APPROVED_TAGS
       - Store JSON.stringify(summary) on ticket.resolution_summary
       - INSERT KBEntry (source: "ticket-resolution", ticket_id)
       - UPDATE ticket: added_to_kb = true, kb_entry_id = new entry id
  3. Fire-and-forget: send_ticket_resolution({ to, customer_name,
                                               ticket_id, query_summary,
                                               resolution_summary: data.resolution_notes })
       - IMPORTANT: the email carries the admin's resolution_notes verbatim,
         NOT the KB-generated summary. The KB summary is neutral / third-person
         / retrieval-optimised; the notes are what the human teammate actually
         wrote and what the customer should read.
       - HTML template uses the same `shell()` chrome as the confirmation
         email, with the status pill flipped to "Resolved" (green) and a
         multiline-aware Resolution row that preserves newlines in the notes.
       - All user-supplied fields escape_html'd.
       - `.catch(err => log.error(...))` so email failure never breaks resolve.
        │
        ▼
Admin sees: "Resolved." (and if add_to_kb was on: "Added to KB as entry kb-018.")
Customer receives the resolution email within seconds.
```

---

## Agent System Prompt (`constants/prompts.ts`)

The agent's identity is "Aarogya". The prompt is intentionally **conversational** tool-calling is gated on intent, not forced on every input.

```
You are Aarogya, the customer support agent for InsureCo a health insurance company.
You're warm, concise, and helpful.

## Conversational behaviour

- For greetings, thanks, small-talk, or meta questions ("who are you?", "what can you do?"),
  reply directly in 1-2 sentences. Do NOT call any tool.
- For genuine InsureCo / health-insurance questions (claims, billing, policy, coverage,
  hospitalisation, network, deductible, cashless, maternity, exclusions, portal, renewal,
  NCB, portability, complaints, etc.), call the smart_search tool BEFORE answering. Pass
  the user's question verbatim as 'query' and 1-3 relevant tags.
- For clearly off-topic questions (politics, sports, programming, weather, etc.), politely
  decline in one line. Do NOT call the tool.
- For ambiguous queries, ask one short clarifying question before searching.

## Using tool results

The smart_search tool returns either:
- { source: "kb", entries: [...] }                       → from KB
- { source: "web", primary: {...}, related: [...] }      → from public web
- { source: "ai", found: false }                         → nothing relevant

Rules when a tool result is present:
1. Ground every factual claim in the tool result. No invented numbers / clauses.
2. source "kb": answer directly, no disclaimer.
3. source "web": open with "Based on general web information (not your specific
   policy):" then answer. End with a "Sources:" section that lists the primary URL
   first (the one cited) followed by every related URL cited AND non-cited.
4. source "ai" / found:false: apologise briefly, offer a support ticket.
5. Never fabricate policy numbers, claim statuses, member IDs, or account data.
6. Keep answers under 150 words unless asked for detail.
7. After ~3 unresolved exchanges on the same topic, offer a support ticket.
```

**At request time** (in `agent-service.stream_agent_response`) the prompt has a "Web grounding context" block appended IF `allowed_domains.length > 0`. The block lists the active domains, names the brand-frame rule ("prudential.com → Prudential"), and explicitly forbids leaking the internal persona name "InsureCo" into the `query` field. The same anti-leak instruction is also stamped into the `smart_search` tool's `query` parameter description via `z.string().describe(...)`. Both texts are recomputed every request, so changing `/admin/settings` immediately reshapes the next call no caching.

The four helper prompts also live in `prompts.ts`:

- `SCORE_SYSTEM_PROMPT` LLM judge rubric (described in the Retrieval section above).
- `WEB_GUARDRAIL_PROMPT` neutral fact extractor + relevance classifier. Output is a third-person digest the main agent quotes from no second-person, no advice, no closing disclaimer (the main agent owns those).
- `SUMMARY_SYSTEM_PROMPT` Haiku call that converts a resolved ticket into a KB entry.
- `TICKET_SUMMARY_PROMPT` Haiku call that condenses a session into a one-line ticket summary.

---

## API Routes (Express Backend)

```
POST   /api/chat                         ← streaming agent endpoint (SSE)
POST   /api/tickets                      ← create ticket (body now includes
                                           customer_name / email / phone; fires
                                           Resend confirmation on success)

GET    /api/tickets                      ← list tickets (admin, paginated)
GET    /api/tickets/:id                  ← single ticket detail + conversation
PATCH  /api/tickets/:id                  ← resolve + optional KB push; fires
                                           Resend resolution email on success

GET    /api/kb                           ← list KB entries
POST   /api/kb                           ← manually add KB entry (admin)
DELETE /api/kb/:id                       ← remove KB entry (admin)

GET    /api/settings                     ← read the single SearchSettings row
PUT    /api/settings                     ← update allowed_domains / blocked_domains
                                           (both required arrays; takes effect
                                           on the next /api/chat request)
```

### SSE Response Format for `/api/chat`

```
event: delta
data: "Based on your policy..."

event: delta
data: " physiotherapy is covered up to 20 sessions."

event: metadata
data: {"source":"kb","confidence_score":0.84,"kb_entry_id":"kb-003","search_result_id":"sr-xyz"}

event: done
data: {}
```

For web answers the metadata payload includes the full URL set in two shapes flat URL strings (`web_source_url`, `web_source_urls`) for legacy/quick rendering, plus structured `{url, title}` pairs (`web_relevant_urls`, `web_irrelevant_urls`) that drive the in-message "Web sources" dropdown:

```
event: metadata
data: {
  "source": "web",
  "confidence_score": 0.5,
  "web_source_url": "https://web.prudential.com/.../GI_Critical_Illness_Summary.pdf",
  "web_source_urls": [
    "https://web.prudential.com/.../GI_Critical_Illness_Summary.pdf",
    "https://web.prudential.com/.../GL.2013.078.pdf",
    "https://web.prudential.com/.../GI_Critical_Illness_Flyer.pdf",
    "https://www.prudential.com/.../Prudential+Healthcare+Guide.pdf"
  ],
  "web_relevant_urls": [
    { "url": "https://web.prudential.com/.../GI_Critical_Illness_Summary.pdf",
      "title": "[PDF] STRATEGIES FOR ADDING CRITICAL ILLNESS INSURANCE TO..." },
    { "url": "https://web.prudential.com/.../GL.2013.078.pdf",
      "title": "[PDF] Critical Illness Insurance Claim Form Prudential Financial" }
  ],
  "web_irrelevant_urls": [
    { "url": "https://web.prudential.com/.../CARE-annuities.pdf",
      "title": "[PDF] CARE Prudential Annuities" }
  ],
  "search_result_id": "sr-abc"
}
```

On the "no relevant web hits" path the metadata still ships `web_irrelevant_urls` so the UI can show "we did search here's what got rejected", but `source` resolves to `"ai"` and the agent falls through to its apology + ticket-offer branch:

```
event: metadata
data: {
  "source": "ai",
  "confidence_score": 0,
  "web_irrelevant_urls": [
    { "url": "https://investor.prudential.com/.../earnings-q3-2024.aspx",
      "title": "Earnings Q3 2024" }
  ]
}
```

For no-tool responses (greetings, declines, ambiguity prompts) the SDK's `onFinish` hook resolves a fallback metadata so the `done` event still fires:

```
event: metadata
data: {"source":"ai","confidence_score":0}

event: done
data: {}
```

---

## Source Badge Spec (Frontend)

`SourceBadge.tsx` reads `metadata.source` from the SSE metadata event:

| `source` | Badge text | Colour | Shown when |
|---|---|---|---|
| `"kb"` | ✓ Answered from KB | Green | LLM judge confidence ≥ `KB_CONFIDENCE_THRESHOLD` (0.6) |
| `"web"` | 🌐 Answered from Web | Amber | Judge rejected KB (or KB empty) AND web hit + guardrail passed |
| `"ai"` | ✦ Aarogya | Gray | Either: small-talk / off-topic (no tool call), OR tool ran but both KB and web failed |

`ConfidencePill.tsx` only when source = `"kb"`. Displays the **LLM judge's** confidence, not the raw cosine similarity:
```
KB match: 84%
```

For `source: "web"` (and for `"ai"` responses that came after a web search but produced no relevant hits) the UI also renders the **WebSourcesDropdown** below the message bubble a collapsible card with two sections: green-checkmarked "Relevant" entries on top, muted "Filtered out" entries below with a short note explaining the rejection. Each row shows the page title and host; clicking opens the URL in a new tab. URLs are matched into `{url, title}` pairs via `metadata.web_relevant_urls` / `metadata.web_irrelevant_urls`. The agent's streamed answer mirrors this in text-only form: a numbered "Sources:" footer with titles only, no inline URLs (the dropdown is the canonical place for clickable sources).

---

## Frontend Pages

### `/` Customer Chat
- ChatGPT-style message history
- Each AI message: SourceBadge + ConfidencePill (when source = "kb") + WebSourcesDropdown (when any URL is present)
- TicketCTA below every AI response: "Still need help? → Create a ticket"
- Clicking the CTA opens **TicketForm** inline below the message: name + email + phone (all required) + Cancel / Create. Submits to POST /api/tickets. On success, inline confirmation banner shows the ticket id + a toast "confirmation sent to <email>".
- Session ID is a per-chat UUID kept in `localStorage` under `insureco.session_id`. Persists across reloads so a refresh mid-conversation doesn't lose state. **Rotated on "New chat"** (and when the message limit is hit) so the backend's session-scoped rows correspond to one conversation.
- Hard cap: `MAX_USER_MESSAGES_PER_CHAT = 4`. When the user has sent 4 messages, the input disables, a banner appears with a "Start new chat" button, and the next send (if somehow bypassed client-side) is rejected by the backend with HTTP 429 (`chat_limit_reached`). Both the frontend (`lib/limits.ts`) and the backend (`constants/thresholds.ts`) carry the same constant keep them in sync.

### `/admin` Admin Dashboard
- Protected by `ADMIN_SECRET` env var (simple auth header or login page)
- Sidebar nav: **Tickets** · **KB** · **Settings**
- Stats row: total tickets | open | resolved today | KB entries
- Ticket table: ID, query summary, status badge, created_at, customer email, action buttons
- Click ticket → drawer with full conversation + all message metadata + customer contact info
- Resolve form: resolution notes textarea + "Add to KB" toggle + Resolve button. Resolution notes are what get emailed to the customer verbatim newlines preserved.
- KB tab: table of all entries, source badge (manual/ticket-resolution), delete button

### `/admin/settings` Web Grounding
- Two-column chip editor:
  - **Allowed Domains** (green chips): Tavily's `includeDomains`. Each chip is a domain string with an `×` to remove. An input + Add button to append. Empty = "no restriction (open web)".
  - **Blocked Domains** (red chips): Tavily's `excludeDomains`. Same chip UX.
- Domain validation: `/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` (no subdomains-of-subdomains gymnastics; admin can also paste `www.x.com` and it normalises lowercase).
- Save → PUT /api/settings. State is optimistic and toasts on success.
- "Changes apply immediately to all new queries." There is no caching layer the next `/api/chat` request reads the row.

---

## KB Seed Data (`data/kb.json`)

22 entries with `title`, `content`, `tags`, and `source` fields. See `data/kb.json` for full content (too large to inline here). Tags include 23 approved values covering deductible, claims, cashless, network, coverage, exclusions, physiotherapy, wellness, medicines, emergency, operations, pre-auth, maternity, mental-health, waiting-period, ncb, renewal, portability, complaints, day-care, co-pay, and process.

---

## Full Trace Example A KB Hit

**User:** "Is physiotherapy covered?"

```
Main agent (Haiku via streamText) calls:
  smart_search({ query: "physiotherapy covered",
                 tags: ["physiotherapy", "wellness", "coverage"] })

Stage 1 kb-service.search_kb:
  - generate_embedding("physiotherapy covered") → number[256]
  - pgvector cosine search with jsonb tag overlap, threshold 0.3, top-K 5:
      kb-007 (Physiotherapy & Wellness)  sim 0.71  tag match ✓
      kb-003 (Medicines & Coverage)      sim 0.42  tag match ✓
  Returns 2 candidates.

Stage 2 score-service.score_kb_results:
  user_query = "Is physiotherapy covered?"
  tool_query = "physiotherapy covered"
  entries    = [kb-007, kb-003]
  → Haiku judge: { confidence: 0.92, best_entry_index: 0,
                   reasoning: "directly answers physio coverage and session cap" }

Decision: confidence 0.92 ≥ 0.6 → KB path

search_results row: { search_type: "kb", confidence: 0.92,
                      top_entry_id: "kb-007", used: true }

Main agent answers: "Physiotherapy is covered up to 20 sessions per year
under the Wellness add-on. Check your plan dashboard to confirm if this
add-on is active."

messages row: { source: "kb", confidence_score: 0.92, kb_entry_id: "kb-007" }

UI: "✓ Answered from KB" (green)  |  "KB match: 92%"
```

---

## Full Trace Example B KB Miss (judge rejects) → Web Fallback

**User:** "Is knee replacement surgery covered?"

```
Main agent calls:
  smart_search({ query: "knee replacement surgery covered",
                 tags: ["operations", "coverage", "hospitalisation"] })

Stage 1 kb-service.search_kb:
  - pgvector cosine search returns:
      kb-010 (Pre-Authorisation Process)  sim 0.48  tag match ✓
      kb-005 (General Coverage Overview)  sim 0.41  tag match ✓
  Both above the 0.3 noise floor, so they reach the judge.

Stage 2 score-service.score_kb_results (check-chain: OpenAI):
  → judge: { confidence: 0.35, best_entry_index: 0,
             reasoning: "topically related to coverage but no
                         knee-replacement specifics present" }

Decision: confidence 0.35 < 0.6 → fall through to web.

search-service.web_search("knee replacement surgery covered health insurance India"):
  - Tavily SDK returns 5 results
  - Guardrail + summariser LLM (check-chain: OpenAI primary, Gemini fallback)
    reads all 5 hits + USER_QUERY and returns:
      {
        final_summarized_output: "Knee replacement surgery is typically
          covered under Standard and Premium health insurance plans in
          India, subject to prior authorisation. Coverage details vary
          by insurer; confirm with your policy document.",
        relevant_urls: [
          "https://example.com/knee-replacement",
          "https://irdai.gov.in/coverage",
          "https://policybazaar.com/..."
        ],
        irrelevant_urls: [
          "https://random-hospital-ad.com/knee-camp",
          "https://news.example.com/celebrity-knee-surgery"
        ],
        reasoning: "3 results discuss coverage policy; 2 are off-topic
                    marketing/news pages."
      }

search_results row: { search_type: "web", confidence: 0.50,
                      web_source_url: "https://example.com/knee-replacement",
                      results_json: <full guardrail payload incl.
                                     irrelevant_urls for audit>,
                      used: true }

Main agent receives:
  { source: "web",
    summary: "<final_summarized_output>",
    relevant_urls: [{ url, title } x 3],
    disclaimer: "Based on general web information (not your specific policy):" }

Main agent answers (quotes summary, lists relevant_urls):

  "Based on general web information (not your specific policy):
   Knee replacement surgery is typically covered under Standard and Premium
   health insurance plans in India, subject to prior authorisation. Coverage
   details vary by insurer; confirm with your policy document.

   Sources:
   - Knee Replacement Coverage Guide https://example.com/knee-replacement
   - IRDAI Hospitalisation Norms https://irdai.gov.in/coverage
   - Comparing Comprehensive Plans https://policybazaar.com/..."

messages row: { source: "web", confidence_score: 0.50,
                search_result_id: "sr-abc" }

metadata event payload's web_source_urls contains only the 3 relevant URLs.
The 2 irrelevant URLs are dropped from user-facing output but persisted in
search_results.results_json for audit.

UI: "🌐 Answered from Web" (amber) + URL list rendered from web_source_urls
```

---

## Full Trace Example C Ticket Resolution → KB Loop

```
Ticket T-019 opened:
  query_summary: "User asked about knee replacement surgery coverage"
  status: "open"

Admin writes resolution_notes:
  "Knee replacement (arthroplasty) is covered under Standard and Premium plans with
   pre-auth. Not covered under Basic plan. Submit pre-auth via portal > Claims > Pre-Auth."

PATCH /api/tickets/T-019 { resolution_notes: "...", add_to_kb: true }

summarise-service calls claude-haiku-4-5-20251001:
  Returns:
  {
    "question": "Is knee replacement surgery covered under my health insurance?",
    "answer": "Knee replacement (arthroplasty) is covered under Standard and Premium plans with prior authorisation. It is not available under the Basic plan. Submit a pre-authorisation request via the member portal under Claims > Pre-Auth.",
    "tags": ["operations", "coverage", "hospitalisation", "portal"]
  }

ticket row updated: status "resolved", added_to_kb true, kb_entry_id "kb-009"
kb.json appended: entry kb-009 (source: "ticket-resolution", ticket_id: "T-019")

  Next user asks "Is knee surgery covered?" →
  Embedding similarity kb-009 against query → 0.92 confidence
  Answered from KB ✓ no web search, no ticket
```

---

## Approved Tag List (`constants/tags.ts`)

```typescript
export const APPROVED_TAGS = [
  "operations",
  "medicines",
  "claims",
  "billing",
  "policy",
  "wellness",
  "network",
  "hospitalisation",
  "deductible",
  "portal",
  "coverage",
  "emergency",
  "physiotherapy",
  "cashless",
  "process",
  "exclusions",
  "maternity",
  "mental-health",
  "waiting-period",
  "ncb",
  "renewal",
  "portability",
  "complaints",
] as const

export type TKBTag = typeof APPROVED_TAGS[number]
```

---

## Coding Conventions

### Backend
- Functions: `snake_case` `search_kb`, `create_ticket`, `score_kb_results`
- Types: `T<CamelCase>` prefix `TMessage`, `TTicket`, `TKBEntry`, `TSearchRecord`
- Files: `kebab-case` `kb-service.ts`, `ticket-controller.ts`, `score-utils.ts`
- Env: Bun native `Bun.env.ANTHROPIC_API_KEY`
- DB: Prisma singleton via `globalThis.__prisma` in `db/client.ts`

### Frontend
- Components: PascalCase `ChatWindow.tsx`, `SourceBadge.tsx`
- Hooks: camelCase with `use-` file prefix `use-chat.ts`, `use-tickets.ts`
- Types: `types/index.ts`, mirror backend `T` prefix convention

---

## Known Limitations

- Embedding generation requires an internet call to OpenAI per query (~200ms). No local cache.
- Stage-2 LLM judge adds one Haiku call per RAG-having query (~300–500ms). Worth it for precision but it is a latency cost.
- Tavily web search is rate-limited by plan; no caching layer in front of it. The 15 s timeout is the only safety net.
- `SearchSettings` is read on every chat request (one cheap SELECT). For higher QPS this should be cached in process memory with a TTL or invalidated on PUT /api/settings.
- Resend transactional email is fire-and-forget; failures are logged but not retried. No bounce / delivery webhook handling. `RESEND_FROM_MAIL` must be a verified sender or `onboarding@resend.dev` for sandbox.
- No user authentication. Sessions are anonymous per-chat UUIDs in localStorage (rotated on "New chat").
- Admin panel uses env-var header check only not production-grade auth.
- `kb.json` is a flat file used only for first-time seed; the running source of truth is Postgres.
- Admin panel polls for new tickets every 30s no real-time push.
- Web-grounding settings are global, not per-tenant. A multi-brand deployment would need `session_id`-scoped or org-scoped settings rows.