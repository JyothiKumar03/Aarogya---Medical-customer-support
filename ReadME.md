# Aarogya: AI Customer Support for Health Insurance

Hey! This is a opinionated customer support system I built for a (fictional) health insurance company. The idea is simple: one friendly agent named **Aarogya** that can hold a normal conversation, search a curated knowledge base when a real question comes up, fall back to the public web when the KB is thin, and quietly raise a support ticket when the human side of things needs to step in.

If you want the deep technical tour, read [Architecture.md](Architecture.md). This file is the welcome mat: what it is, how to run it, and how the pieces fit together at a glance.

---

## What it does (the 30-second version)

You ask Aarogya something. It decides:

1. Is this small-talk or off-topic? Reply directly. No tools, no fuss.
2. Is this a real health-insurance question? Call the one tool it has, `smart_search`.
3. `smart_search` looks in the knowledge base first using pgvector + an LLM judge. If the judge is at least 60% confident the KB actually answers the question, that wins.
4. If not, it hops to a guardrailed Tavily web search. The answer comes back with a "based on general web info" disclaimer and every source URL listed.
5. If the user is still stuck, they can open a ticket. When an admin resolves it, the resolution can be turned into a fresh KB entry, so the system gets a little smarter every time.

That's the whole loop.

---

## VIDEO DEMO
[[Watch the video]](https://www.loom.com/share/70af1afec05e4ae0b25b90907b801b97)



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
| Web search | Tavily SDK (`@tavily/core`) |
| ORM | Prisma |
| UI | shadcn/ui on top of the Vercel ai-chatbot template |

---

### A few things worth flagging

- **The KB vs web decision lives in code, not in the prompt.** The agent never decides which source to use. `agent-service.ts` runs the gate against the LLM judge's confidence score. That keeps behaviour predictable.
- **Two-stage retrieval is on purpose.** Cosine similarity tells you what's topically close. The LLM judge tells you whether the closest entries actually answer the question. Two passages can be 0.7-similar and still miss the point; the judge is the gate, the cosine floor is just noise control.
- **One tool, one job.** Aarogya only ever calls `smart_search`. Everything else (small talk, declines, clarifying questions) happens inline in the agent. Fewer tools means fewer ways to be wrong.
- **The KB feeds itself.** When a ticket is resolved, an admin can flip "Add to KB" and the resolution gets summarised into a clean Q&A, embedded, and inserted. Next time someone asks a similar question, the KB has the answer.

### The four tables

- **kb_entries**: the knowledge base. Seeded from `backend/data/kb.json` on first run, grows from resolved tickets.
- **messages**: every chat message, with source metadata on assistant turns.
- **search_results**: every KB and web search performed. Audit trail for "why did it answer that way?".
- **tickets**: support tickets, full conversation stored as JSON.

For the full schema, types, prompts, and trace examples, see [Architecture.md](Architecture.md).

---

## Project layout

```
medical-customer-support-agent/
├── backend/              Bun + Express API
│   ├── src/
│   │   ├── controllers/  thin HTTP handlers
│   │   ├── routes/       Express routing
│   │   ├── services/     the real logic (agent, kb, score, search, ticket)
│   │   ├── constants/    prompts, tags, thresholds (all centralised)
│   │   ├── db/           Prisma client + seed
│   │   └── types/        TMessage, TTicket, TKBEntry, etc.
│   ├── prisma/schema.prisma
│   └── data/kb.json      seed KB
├── frontend/             Next.js App Router
│   ├── app/              "/" customer chat, "/admin" dashboard
│   ├── components/chat/  ChatWindow, SourceBadge, ConfidencePill, TicketCTA
│   └── components/admin/ TicketTable, ResolveModal, KBFeedbackToggle
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
  - OpenAI (embeddings only)
  - Tavily (web fallback)

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
TAVILY_API_KEY="tvly-..."
ADMIN_SECRET="some-long-random-string"
PORT=3001
```

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
3. Ask something the seed KB doesn't cover, like **"Is knee replacement surgery covered?"**. The KB judge will reject, the system falls through to Tavily, and you get a **From Web** badge with a sources list rendered below the answer.
4. Ask something unrelated like **"who won the cricket match last night?"**. Aarogya politely declines without calling the tool.
5. Click **"Still need help?"** to open a ticket. Visit `/admin`, find your ticket, write a resolution, flip the **Add to KB** toggle, and hit Resolve. Now ask the same question in a fresh chat. The new KB entry will answer it.

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
