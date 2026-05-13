# Architecture AI-Powered Health Insurance Support System

## System Overview

A decoupled Express (backend) + Next.js (frontend) platform for a health insurance company's customer support. One AI agent (Aarogya) handles the full conversation lifecycle: replies conversationally to small-talk, calls a single `smart_search` tool for genuine health-insurance questions, and politely declines off-topic. The tool runs a pgvector RAG over a tag-filtered knowledge base (cosine similarity, top-K = 5, floor = 0.3), then a small LLM judge scores answerability of the retrieved context from 0–1; below `KB_CONFIDENCE_THRESHOLD = 0.6` the system falls back to a guardrailed Tavily web search whose top-5 hits are passed through a second LLM that classifies every URL as relevant or irrelevant and writes a single summarised answer the main agent can quote from. The KB judge and the web guardrail share a dedicated provider chain (OpenAI primary, Gemini fallback) so the main agent's model preference does not bias retrieval gating. If the customer is still unsatisfied the conversation can be escalated to a ticket, and resolved tickets optionally feed a Claude-generated summary back into the KB closing the self-improvement loop.

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
| Web search | Tavily SDK (`@tavily/core`) top-5 results, then LLM-classified into relevant/irrelevant URLs + a pre-written summary |
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
│   │   │   └── kb-controller.ts
│   │   ├── routes/
│   │   │   ├── chat-routes.ts
│   │   │   ├── ticket-routes.ts
│   │   │   └── kb-routes.ts
│   │   ├── services/
│   │   │   ├── agent-service.ts        ← orchestrates streamText + smart_search tool + decision flow
│   │   │   ├── ai-service.ts           ← model factory + generate/stream w/ fallback + two provider chains (main vs check)
│   │   │   ├── embedding-service.ts    ← text-embedding-3-small (256-dim) wrapper
│   │   │   ├── kb-service.ts           ← pgvector RAG + SQL tag filter + KB CRUD
│   │   │   ├── score-service.ts        ← LLM judge on check-chain (user_query + tool_query + entries → confidence 0–1)
│   │   │   ├── search-service.ts       ← Tavily SDK + LLM guardrail/summariser on check-chain (returns summary + relevant_urls + irrelevant_urls + reasoning)
│   │   │   ├── ticket-service.ts       ← ticket lifecycle
│   │   │   ├── summarise-service.ts    ← resolution → KB summary
│   │   │   └── logger-service.ts       ← structured scoped logger
│   │   ├── db/
│   │   │   ├── client.ts               ← Prisma singleton
│   │   │   └── seed.ts                 ← seeds kb.json → DB on first run
│   │   ├── types/
│   │   │   ├── agent-types.ts
│   │   │   ├── ticket-types.ts
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
    │   │   └── page.tsx                ← admin ticket dashboard
    │   └── layout.tsx
    ├── hooks/
    │   ├── use-chat.ts
    │   ├── use-tickets.ts
    │   └── use-kb.ts
    ├── components/
    │   ├── chat/
    │   │   ├── ChatWindow.tsx
    │   │   ├── MessageBubble.tsx
    │   │   ├── SourceBadge.tsx          ← "From KB" / "From Web" / "AI"
    │   │   ├── ConfidencePill.tsx       ← "KB match: 82%"
    │   │   └── TicketCTA.tsx            ← "Still need help?" button
    │   └── admin/
    │       ├── TicketTable.tsx
    │       ├── ResolveModal.tsx
    │       └── KBFeedbackToggle.tsx     ← "Add resolution to KB" checkbox
    ├── lib/
    │   └── api.ts                       ← typed fetch wrappers
    └── types/
        └── index.ts
```

---

## DB Schema (All 4 Tables)

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
Support tickets created when user signals dissatisfaction. Full conversation stored.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `session_id` | `String` | |
| `query_summary` | `String` | 1-line Haiku-generated summary of the user's issue |
| `conversation_json` | `String` | Full `TMessage[]` as JSON string |
| `status` | `String @default("open")` | `"open"` \| `"in_progress"` \| `"resolved"` |
| `resolution_notes` | `String?` | Written by admin |
| `resolution_summary` | `String?` | Claude-generated KB-ready Q&A |
| `added_to_kb` | `Boolean @default(false)` | Was resolution pushed to KB |
| `kb_entry_id` | `String?` | FK → kb_entries.id if added |
| `created_at` | `DateTime @default(now())` | |
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

type TResponseMetadata = {
  source: TMessageSource
  confidence_score?: number     // For "kb": LLM judge confidence. For "web": WEB_CONFIDENCE_FLOOR. For "ai": 0
  kb_entry_id?: string
  web_source_url?: string        // primary (cited) URL
  web_source_urls?: string[]     // primary + all related URLs returned by Tavily
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
  created_at: Date
  updated_at: Date
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
4.  agent-service runs Vercel AI SDK streamText with:
    - system prompt (conversational; see constants/prompts.ts)
    - full conversation history
    - ONE tool: smart_search
    - maxSteps: 2   (cap on one tool round-trip)
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
              search-service.web_search(query + " health insurance India")
              - Tavily SDK (@tavily/core), maxResults: 5
              - Guardrail + summariser LLM (check-chain: OpenAI primary,
                Gemini fallback) reads ALL 5 hits and the user query, and
                returns a single structured object:
                  {
                    final_summarized_output: string,   // 2–4 sentence answer
                    relevant_urls:    string[],        // URLs that helped
                    irrelevant_urls:  string[],        // URLs rejected as off-topic
                    reasoning:        string
                  }
              - If relevant_urls is empty → treated as a web miss.
              - Otherwise return:
                  { found: true, summary, relevant_urls[], irrelevant_urls[], reasoning }
                    │
                    ▼
              On web hit:
                - Save `search_results` (search_type: "web",
                  confidence: WEB_CONFIDENCE_FLOOR,
                  web_source_url: relevant_urls[0].url,
                  used: true; full payload in results_json)
                - Return to main agent:
                  { found: true, source: "web", summary, relevant_urls, disclaimer }
                - Resolve metadata { source: "web", confidence_score,
                                     web_source_url, web_source_urls, search_result_id }
                    │
              On web miss:
                - Resolve metadata { source: "ai", confidence_score: 0 }
                - Return { found: false, source: "ai", reason }
        │
        ▼
10. Main agent composes the user-facing answer grounded in the tool result
    (or, in the no-tool-call branch, answers directly). For source = "web",
    the agent quotes from `summary` rather than reading raw web content
    the heavy lifting (classification + synthesis) already happened in the
    guardrail/summariser step.
        │
        ▼
11. For web answers: the response ends with a "Sources:" footer that bullets
    every entry in `relevant_urls` as "<title> <url>". Irrelevant URLs are
    dropped from user-facing output but persisted in `results_json` for audit.
        │
        ▼
12. chat-controller persists the assistant TMessage with metadata.
        │
        ▼
13. SSE stream to frontend:
    - event: delta     (text chunks)
    - event: metadata  ({ source, confidence_score, kb_entry_id?,
                          web_source_url?, web_source_urls?, search_result_id? })
    - event: done
        │
        ▼
14. UI renders:
    - Message bubble
    - SourceBadge: "From KB" (green) | "From Web" (amber) | "Aarogya" (gray)
    - ConfidencePill: "KB match: 82%" only when source = "kb"
    - URL list under web answers (rendered from web_source_urls)
    - TicketCTA: "Still need help? → Create a ticket"
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

### Web guardrail / summariser (`search-service.web_search`)

When KB confidence < 0.6, the system queries Tavily and then runs a single LLM pass on the **check-provider chain** (OpenAI primary, Gemini fallback) that does both relevance classification and answer synthesis in one shot:

- Input: `USER_QUERY` + the 5 Tavily hits (title, url, content).
- Output (via `generateObject` with a Zod schema):
  ```ts
  {
    final_summarized_output: string,   // 2-4 sentence answer drawn ONLY from relevant hits
    relevant_urls:    string[],        // URLs that genuinely answer USER_QUERY in a health-insurance context
    irrelevant_urls:  string[],        // URLs rejected as off-topic / unhelpful (still kept in audit)
    reasoning:        string
  }
  ```
- If `relevant_urls` is empty → treated as a web miss (main agent gets `source: "ai", found: false`).
- The main agent never sees raw web content; it quotes from `final_summarized_output` and renders `relevant_urls` as the Sources footer. This keeps the main-agent prompt tight and ensures off-topic web junk cannot end up in the response.

**Why a separate check-provider chain?** The KB judge and the web guardrail both gate what the main agent is allowed to say. Running them on a different vendor from the main agent (OpenAI/Gemini vs Anthropic for the main agent) means a quirk in one vendor's instruction-following can't simultaneously bias retrieval gating *and* answer composition.

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
User clicks "Still need help?" or types "raise a ticket"
        │
        ▼
POST /api/tickets
Body: { session_id, conversation_history: TMessage[] }
        │
        ▼
ticket-service.create_ticket():
  1. LLM call: generate query_summary from last 3 user messages (1 sentence max)
  2. INSERT ticket row (status: "open", conversation_json: serialised history)
  3. Return { ticket_id, status: "open" }
        │
        ▼
UI: "Ticket #T-019 created. Our team will reach out within 24 hours."
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
  2. Call summarise-service.generate_resolution_summary(conversation, resolution_notes)
            │
            └── claude-haiku-4-5-20251001 call:
                "Given this support conversation and the agent's resolution notes,
                 produce a KB entry. Return ONLY valid JSON:
                 { title: string, content: string, tags: string[] }
                 Tags must be from the approved list only.
                 Answer must be 2–3 sentences, factual, no first-person pronouns."
            │
            └── Parse JSON, validate tags against APPROVED_TAGS
  3. Store resolution_summary on ticket row
  4. If add_to_kb = true:
       - Append to data/kb.json (persist across restarts)
       - INSERT KBEntry (source: "ticket-resolution", ticket_id)
       - UPDATE ticket: added_to_kb = true, kb_entry_id = new entry id
        │
        ▼
Admin sees: "Resolved. Added to KB as entry kb-018."
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

The two helper prompts also live in `prompts.ts`:

- `SCORE_SYSTEM_PROMPT` LLM judge rubric (described in the Retrieval section above).
- `WEB_GUARDRAIL_PROMPT` binary relevance filter applied to the top Tavily result before web content reaches the agent.
- `SUMMARY_SYSTEM_PROMPT` Haiku call that converts a resolved ticket into a KB entry.
- `TICKET_SUMMARY_PROMPT` Haiku call that condenses a session into a one-line ticket summary.

---

## API Routes (Express Backend)

```
POST   /api/chat                         ← streaming agent endpoint (SSE)
POST   /api/chat/:session_id/ticket      ← create ticket from a session

GET    /api/tickets                      ← list tickets (admin, paginated)
GET    /api/tickets/:id                  ← single ticket detail + conversation
PATCH  /api/tickets/:id                  ← resolve + optional KB push

GET    /api/kb                           ← list KB entries
POST   /api/kb                           ← manually add KB entry (admin)
DELETE /api/kb/:id                       ← remove KB entry (admin)
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

For web answers the metadata payload additionally includes `web_source_url` (primary) and `web_source_urls` (primary + every related URL):

```
event: metadata
data: {"source":"web","confidence_score":0.5,
       "web_source_url":"https://example.com/knee-replacement",
       "web_source_urls":["https://example.com/knee-replacement",
                          "https://irdai.gov.in/coverage",
                          "https://policybazaar.com/..."],
       "search_result_id":"sr-abc"}
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

For `source: "web"` the UI also renders the URL list from `metadata.web_source_urls` (primary first, then related), so the user can verify the answer against every source the system retrieved cited and non-cited alike.

---

## Frontend Pages

### `/` Customer Chat
- ChatGPT-style message history
- Each AI message: SourceBadge + ConfidencePill (when source = "kb")
- TicketCTA below every AI response: "Still need help? → Create a ticket"
- Inline ticket confirmation with ticket ID on creation
- Session ID is a per-chat UUID kept in `localStorage` under `insureco.session_id`. Persists across reloads so a refresh mid-conversation doesn't lose state. **Rotated on "New chat"** (and when the message limit is hit) so the backend's session-scoped rows correspond to one conversation.
- Hard cap: `MAX_USER_MESSAGES_PER_CHAT = 4`. When the user has sent 4 messages, the input disables, a banner appears with a "Start new chat" button, and the next send (if somehow bypassed client-side) is rejected by the backend with HTTP 429 (`chat_limit_reached`). Both the frontend (`lib/limits.ts`) and the backend (`constants/thresholds.ts`) carry the same constant keep them in sync.

### `/admin` Admin Dashboard
- Protected by `ADMIN_SECRET` env var (simple auth header or login page)
- Stats row: total tickets | open | resolved today | KB entries
- Ticket table: ID, query summary, status badge, created_at, action buttons
- Click ticket → drawer with full conversation + all message metadata
- Resolve modal: resolution notes textarea + "Add to KB" toggle + Resolve button
- KB tab: table of all entries, source badge (manual/ticket-resolution), delete button

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
- Tavily web search is rate-limited by plan; no caching layer in front of it.
- No user authentication. Sessions are anonymous per-chat UUIDs in localStorage (rotated on "New chat").
- Admin panel uses env-var header check only not production-grade auth.
- `kb.json` is a flat file used only for first-time seed; the running source of truth is Postgres.
- Admin panel polls for new tickets every 30s no real-time push.