# Aarogya: AI Customer Support for Health Insurance

Hey! This is a opinionated customer support system I built for a (fictional) health insurance company. The idea is simple: one friendly agent named **Aarogya** that can hold a normal conversation, search a curated knowledge base when a real question comes up, fall back to a domain-curated public web search when the KB is thin, and quietly raise a support ticket and email the customer when the human side of things needs to step in.

If you want the deep technical tour, read [Architecture.md](Architecture.md). This file is the welcome mat: what it is, how to run it, and how the pieces fit together at a glance.

---

## What it does (the 30-second version)

You ask Aarogya something. It decides:

1. Is this small-talk or off-topic? Reply directly. No tools, no fuss.
2. Is this a real health-insurance question? Call the one tool it has, `smart_search`.
3. `smart_search` looks in the knowledge base first using pgvector + an LLM judge. If the judge is at least 60% confident the KB actually answers the question, that wins.
4. If not, it hops to a guardrailed Tavily web search **restricted to the domains an admin has whitelisted** (default: `prudential.com`). A second LLM classifies every hit as relevant or irrelevant and produces a neutral fact digest. The main agent quotes from that digest with a "based on general web info" disclaimer; the UI shows the customer both the relevant *and* the filtered-out sources, so nothing is hidden.
5. If the user is still stuck, they can open a ticket with their name, email and phone. A confirmation email goes out on creation; a resolution email goes out when the admin marks it resolved. When an admin resolves it, the resolution can be turned into a fresh KB entry, so the system gets a little smarter every time.

That's the whole loop.

---

## VIDEO DEMO
[[Watch the video]](https://www.loom.com/share/1d7b079cfb534c66a2146c49a240a384)



![Architecture](assets/aarogya-architecture.jpeg)


## Architecture brief

```
                       ┌─────────────┐
   User message  ───▶  │  Aarogya    │   one tool: smart_search
                       │  (Haiku)    │
                       └──────┬──────┘
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
         small talk / off-topic     real question
         (reply directly,           call smart_search(query, tags)
          source = "ai")                  │
                                          ▼
                              ┌─────────────────────────┐
                              │ Stage 1: pgvector recall│
                              │ cosine search, top-K 5  │
                              │ tag filter in SQL       │
                              └───────────┬─────────────┘
                                          ▼
                              ┌─────────────────────────┐
                              │ Stage 2: LLM judge      │
                              │ scores 0 to 1     │
                              │ "does this answer it?"  │
                              └───────────┬─────────────┘
                                          │
                       ┌──────────────────┴──────────────────┐
                       ▼                                     ▼
              confidence >= 0.6                       confidence < 0.6
              source: "kb"                            ▼
                                              Tavily web search
                                              + guardrail LLM
                                              source: "web"
                                              or "ai" if nothing
```


## The stack

| Layer | Choice |
|---|---|
| Backend runtime | Bun |
| Backend framework | Express + TypeScript |
| Frontend | Next.js 16 (App Router) + TypeScript |
| Main agent | Claude `claude-haiku-4-5-20251001` (via Vercel AI SDK `streamText`) |
| Relevance judge | Claude `claude-haiku-4-5-20251001` (via `generateObject` with Zod) |
| Embeddings | OpenAI `text-embedding-3-small` (256-dim) |
| Vector store | PostgreSQL (Neon) + pgvector extension |
| Web search | Tavily SDK (`@tavily/core`) with admin-curated `includeDomains` / `excludeDomains` |
| Transactional email | Resend (`resend` SDK) confirmation on ticket creation, resolution email on close |
| ORM | Prisma |
| UI | shadcn/ui on top of the Vercel ai-chatbot template |

---

### A few things worth flagging

- **The KB vs web decision lives in code, not in the prompt.** The agent never decides which source to use. `agent-service.ts` runs the gate against the LLM judge's confidence score. That keeps behaviour predictable.
- **Two-stage retrieval is on purpose.** Cosine similarity tells you what's topically close. The LLM judge tells you whether the closest entries actually answer the question. Two passages can be 0.7-similar and still miss the point; the judge is the gate, the cosine floor is just noise control.
- **One tool, one job.** Aarogya only ever calls `smart_search`. Everything else (small talk, declines, clarifying questions) happens inline in the agent. Fewer tools means fewer ways to be wrong.
- **Web grounding is admin-curated, not free-roaming.** A `/admin/settings` page writes to a `SearchSettings` row that holds `allowed_domains` + `blocked_domains`. Those drive Tavily's `includeDomains` / `excludeDomains` on every web call. At chat-time, the agent's system prompt and the `smart_search` tool description get a **grounding block injected dynamically** that lists the active domains and tells the agent to frame queries around the brand behind them ("prudential.com" → "Prudential") and to never leak the internal persona name ("InsureCo") into the web query. Change the domains, the next request rebinds automatically no redeploy.
- **The web guardrail produces neutral facts, not customer prose.** The summariser LLM is told it is not the customer-facing agent its job is to extract verifiable facts (numbers, eligibility, processes, named plans) from the relevant URLs, in third-person, with no advice, hedging, or second-person language. The main agent owns the final voice and disclaimer.
- **Web source transparency.** The UI renders a collapsible "Web sources" card below every web-answered message with two sections relevant + filtered-out so customers can see what was searched *and* what got rejected as off-topic.
- **The KB feeds itself.** When a ticket is resolved, an admin can flip "Add to KB" and the resolution gets summarised into a clean Q&A, embedded, and inserted. Next time someone asks a similar question, the KB has the answer.
- **The ticket loop closes on email.** Ticket creation captures name + email + phone via a small in-chat form. Resend fires a branded confirmation email immediately. When the admin resolves the ticket, the customer gets a resolution email with the admin's notes verbatim (HTML preserves newlines and escapes user input).

### The five tables

- **kb_entries**: the knowledge base. Seeded from `backend/data/kb.json` on first run, grows from resolved tickets.
- **messages**: every chat message, with source metadata on assistant turns.
- **search_results**: every KB and web search performed. Audit trail for "why did it answer that way?".
- **tickets**: support tickets, full conversation stored as JSON. Now also carries `customer_name`, `customer_email`, `customer_phone` captured at create time so the email loop has somewhere to send.
- **search_settings**: a single row holding the active `allowed_domains` + `blocked_domains` (JSON-stringified arrays). Seeded with `["prudential.com"]` on first boot; edited from `/admin/settings`.

For the full schema, types, prompts, and trace examples, see [Architecture.md](Architecture.md).

---

## Project layout

```
medical-customer-support-agent/
├── backend/              Bun + Express API
│   ├── src/
│   │   ├── controllers/  thin HTTP handlers (chat, ticket, kb, settings)
│   │   ├── routes/       Express routing
│   │   ├── services/     agent, kb, score, search (Tavily + neutral guardrail),
│   │   │                 ticket, summarise, settings, email (Resend), logger
│   │   ├── constants/    prompts, tags, thresholds (all centralised)
│   │   ├── db/           Prisma client + seed (also seeds default SearchSettings)
│   │   └── types/        TMessage, TTicket, TKBEntry, TSearchSettings, etc.
│   ├── prisma/schema.prisma
│   └── data/kb.json      seed KB
├── frontend/             Next.js App Router
│   ├── app/
│   │   ├── page.tsx              customer chat
│   │   └── admin/
│   │       ├── page.tsx          ticket dashboard
│   │       └── settings/page.tsx web-grounding settings
│   ├── components/chat/  chat-window, message-bubble, source-badge,
│   │                     confidence-pill, ticket-cta, TicketForm (name/email/phone),
│   │                     web-sources-dropdown (relevant + filtered-out URLs)
│   └── components/admin/ ticket-table, ticket-drawer, resolve-form,
│                         GroundingSettings (allowed / blocked domains)
├── scripts/setup.sh      one-shot scaffolder (already run)
├── Architecture.md       the long, technical version of this README
├── CLAUDE.md             house rules for the AI collaborator
└── agent-log.md          running log of build actions
```

---

## Setting it up

### What you need

- **Bun** 1.0+ ([install guide](https://bun.sh))
- **PostgreSQL** with the `pgvector` extension. The easiest path is a free [Neon](https://neon.tech) project; enable `vector` from their SQL editor with `CREATE EXTENSION IF NOT EXISTS vector;`
- API keys for:
  - Anthropic (the agent, the judge, the summariser)
  - OpenAI (embeddings + check-chain primary)
  - Gemini (check-chain fallback, optional)
  - Tavily (web fallback)
  - Resend (transactional email for tickets)

### 1. Clone and install

```bash
git clone <repo>
cd medical-customer-support-agent

# backend
cd backend
bun install

# frontend
cd ../frontend
bun install
```

### 2. Configure the backend

Create `backend/.env`:

```ini
DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
GEMINI_API_KEY="..."                # optional check-chain fallback
TAVILY_API_KEY="tvly-..."
RESEND_API_KEY="re_..."             # for ticket emails
RESEND_FROM_MAIL="support@your-verified-domain.com"   # or onboarding@resend.dev for sandbox
ADMIN_SECRET="some-long-random-string"
PORT=3001
```

If `TAVILY_API_KEY` is missing the web fallback is skipped (chat still works KB-only). If `RESEND_API_KEY` / `RESEND_FROM_MAIL` are missing the email send fails silently in a `.catch` ticket creation/resolution still works, the customer just doesn't get an email. For local demos with no verified domain, set `RESEND_FROM_MAIL=onboarding@resend.dev` Resend's sandbox sender.

Bun loads `.env` automatically. Don't use `dotenv`, don't reach for `process.env` in app code; the codebase uses `Bun.env.*` everywhere on purpose.

### 3. Set up the database

From `backend/`:

```bash
bunx prisma migrate dev --name init
bunx prisma generate
bun run seed
```

The seed step reads `data/kb.json`, generates 256-dim embeddings for each entry via `text-embedding-3-small`, and writes everything to Postgres. It takes a minute on first run because every entry hits the OpenAI API.

If embeddings already exist, the seed is idempotent and won't re-embed.

### 4. Configure the frontend

Create `frontend/.env.local`:

```ini
NEXT_PUBLIC_API_URL="http://localhost:3001"
ADMIN_SECRET="same-long-random-string-as-backend"
```

### 5. Run both sides

In one terminal:

```bash
cd backend
bun run dev          # http://localhost:3001
```

In another:

```bash
cd frontend
bun run dev          # http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) for the chat, and [http://localhost:3000/admin](http://localhost:3000/admin) for the ticket dashboard.

---

## A quick tour you can try

1. Open the chat. Say "hi". Aarogya replies in one line, badge says **Aarogya** (AI Generated). (No tool was called. By design.)
2. Ask **"Is physiotherapy covered?"**. You should see a **From KB** badge and a confidence pill like "KB match: 92%".
3. Ask something the seed KB doesn't cover, like **"Is knee replacement surgery covered?"**. The KB judge will reject, the system falls through to Tavily restricted to `prudential.com` (the default allowed domain), and you get a **From Web** badge with a numbered Sources list in the answer plus a collapsible **Web sources** card below that splits relevant vs filtered-out URLs.
4. Visit `/admin/settings`. Add `policybazaar.com` to allowed domains and save. Run the same web-grounded question in a fresh chat the next Tavily call uses your new domain list immediately, no restart.
5. Ask something unrelated like **"who won the cricket match last night?"**. Aarogya politely declines without calling the tool.
6. Click **"Still need help?"** to open a ticket. The ticket form asks for your name, email, and phone before creating. A confirmation email lands in the inbox within seconds. Visit `/admin`, find your ticket, write a resolution, flip the **Add to KB** toggle, and hit Resolve. A resolution email goes out with your notes. Now ask the same question in a fresh chat the new KB entry will answer it.

That round trip is the whole product in a single five minute session.

---

## Useful scripts

From `backend/`:

| Command | What it does |
|---|---|
| `bun run dev` | Hot-reloading API on port 3001 |
| `bun run start` | Production run |
| `bun run seed` | Re-seed the KB from `data/kb.json` |
| `bun run db:migrate` | Run Prisma migrations |
| `bun run db:studio` | Open Prisma Studio in the browser |

From `frontend/`:

| Command | What it does |
|---|---|
| `bun run dev` | Next.js dev server on port 3000 |
| `bun run build` | Production build |
| `bun run lint` | ESLint pass |


---

## What this isn't

Worth being upfront:

- It's not multi-tenant. Sessions are anonymous.
- It's not production auth. The admin panel is gated by a single shared secret.
- It's not real-time. The admin dashboard polls every 30 seconds.
- It's not optimised for scale. There's no vector index created. With ~22 KB entries pgvector scans a bit slow, which is fine.
- It does not call any real insurance backend. There's no policy lookup, no claim status, no member ID resolver. The agent is explicitly told never to invent those.

This is a build with a sharply scoped surface area. The goal was to nail the retrieval + escalation loop on one realistic domain rather than spread thin across ten.

---

## Where to read next

- [Architecture.md](Architecture.md) for the full system tour, every schema field, every prompt, and three end-to-end trace examples (KB hit, KB miss + web fallback, ticket resolution + KB feedback loop).
- [CLAUDE.md](CLAUDE.md) for the working agreement the AI collaborator follows when editing this repo.
- [problem-statement.md](problem-statement.md) for the original assessment brief.
- [agent-log.md](agent-log.md) for the running log of build decisions.

That's it. Have fun poking at it.
