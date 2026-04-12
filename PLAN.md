# French Freelancer Admin RAG Assistant — Project Plan

> **Status:** day-1 setup done, starting week 1.
> **Codename:** TBD (candidates: URSSAFari, PaperBaguette, MicroBureau, ChargeChat, Urssafé). I'll pick when something clicks.
> **Target domain:** to be purchased when v0.1 ships (~€6/year).

---

## 1. Vision

I'm building a bilingual (FR/EN) AI assistant that answers the administrative and fiscal questions French freelancers constantly struggle with. Things like *"Can I invoice a foreign client in USD as a micro-entrepreneur?"*, *"What's the 2026 CA ceiling?"*, *"When do I have to switch to BNC réel?"*, *"How do I declare a client in Indonesia?"*, *"What's the ACRE reduction schedule?"*, *"Do I need to charge TVA to a Belgian company?"*

Every answer is grounded in official public sources (URSSAF, service-public.gouv.fr, impots.gouv.fr, BOFiP, Légifrance) with clickable citations, a "last updated" date per source, and a clear "consult an accountant for definitive advice" guardrail on high-stakes topics.

**Primary user:** "Lucas, 28, just left his CDI to freelance as a React dev, three weeks into micro-entrepreneur status, drowning in acronyms (URSSAF, CFE, CFP, TVA, BNC, ACRE, CIPAV, SIRET, APE, BIC), no accountant yet because he can't afford one, panicking at every email from a `.gouv.fr` domain."

**Secondary user:** "Aïcha, 35, freelance translator with international clients, fluent in English only, needs to understand French fiscal rules in English because every source she finds is in French."

## 2. Positioning

- **What it is:** a public-knowledge copilot for self-employed French workers.
- **What makes it different:** bilingual FR/EN (French fiscal info in English is a wasteland), cited answers only, explicit "last updated" trail, disclaimer flow on high-stakes topics, full production RAG pipeline (hybrid search, re-ranking, eval harness, observability) — not a toy demo.
- **What it's NOT:** tax optimization advice, personalized financial planning, a portal to file actual tax returns, or an integration with government portals.

## 3. Why I'm building this

- **I'm the user.** I'm becoming a freelancer in a few months. I'll personally use this tool.
- **100% public data.** No scraping ethics drama, no IP risk.
- **Huge target audience.** France has 2M+ micro-entrepreneurs, all confused, all Googling the same 50 questions.
- **Forces real RAG skills.** Legal/fiscal answers must be grounded — hallucinations are dangerous. This pushes me to build real guardrails, citations, and evaluation, not vibe-check RAG.
- **Bilingual is a rare moat.** Almost nobody serves English-speaking freelancers in France properly.
- **Monetizable later** (freemium, €5–10/month, referral to accountant platforms) if I decide to go further.
- **Great article material.** *"I built an AI assistant for URSSAF hell"*, *"Why French public data is gold for AI products"*, *"How I added real citations and cut hallucinations by 70%"*.

## 4. Success criteria

This project is "flagship quality" when ALL of these are true:

- [ ] Deployed at a public URL, accessible without install (Vercel).
- [ ] Works end-to-end: a stranger asks 5 realistic questions and gets cited, correct answers in under 10 seconds each.
- [ ] Bilingual: UI has EN/FR toggle, assistant responds in the language of the question.
- [ ] Every answer has ≥1 inline citation linking to an official public source.
- [ ] Every citation shows the source's "last fetched" date.
- [ ] High-stakes topics (tax thresholds, specific cases) trigger an explicit "this is general information, consult an accountant" disclaimer.
- [ ] Eval harness with ≥30 Q&A test pairs and a measurable accuracy score.
- [ ] README with screenshots, architecture diagram, live link, "how it works" section, eval results.
- [ ] At least one public article published on elgote.com telling the build story (in English).
- [ ] Codebase is 100% English (code, comments, commits, README).

## 5. Non-goals

I'm explicitly saying NO to these until v1 ships:

- Personalized tax advice (liability landmine — disclaimer instead).
- Actual filings / integrations with URSSAF / impots.gouv.fr portals.
- User authentication beyond a single hardcoded demo gate.
- Multi-tenant data, subscriptions, payments, Stripe.
- Admin UI for uploading docs — data is seeded via scripts.
- Mobile app. Responsive web only.
- Voice I/O.
- Image generation.
- Fine-tuning a custom model.
- Slack / Teams / WhatsApp integrations.
- Chat memory / conversation history across sessions (v1.0 is stateless).

If any of these come up before v1 ships: "later."

## 6. Tech stack (free-tier only)

| Layer | Choice | Why | Cost |
|---|---|---|---|
| **Frontend** | Next.js 16 App Router + TypeScript | I already know it, 1-click deploy | Free |
| **Hosting** | Vercel | Native Next.js, generous free tier | Free |
| **UI** | shadcn/ui + Tailwind | Fast, professional look | Free |
| **Chat / streaming** | Vercel AI SDK v6 + `@ai-sdk/react` | Industry standard in 2026 | Free |
| **LLM** | Gemini free tier (primary), Groq/Llama (fallback) | Both have real free tiers, multilingual-strong | Free |
| **Embeddings** | `gemini-embedding-001` or Nomic via Ollama local | Multilingual, free | Free |
| **Vector DB** | pgvector on Supabase | I already use Supabase, real production pattern | Free |
| **Relational DB** | Same Supabase Postgres | One DB = simpler, hybrid search friendly | Free |
| **i18n** | `next-intl` | Standard for Next.js App Router | Free |
| **Observability** | Langfuse (cloud free tier or self-hosted Docker) | Real RAG needs observability | Free |
| **Eval** | Custom script + Langfuse datasets (or Promptfoo) | Measure, don't vibe-check | Free |
| **Scraping / ingestion** | `fetch` + `jsdom` + `@mozilla/readability` + `pdf-parse` | Public official pages only, respect robots.txt | Free |
| **Domain** | `*.vercel.app` → real domain when v0.1 ships | €6 deferred | €6 deferred |

**Not using:**
- LangChain / LlamaIndex — too much magic, hides the pipeline. I want to learn RAG by building it myself.
- Pinecone / Weaviate Cloud — unnecessary when pgvector is right there.
- OpenAI — paid, and Gemini/Groq free tiers cover me.

## 7. Data strategy

This project uses **100% real public data**. Real sources, real citations, real value.

**Sources (all public, all official):**

- **URSSAF** (`urssaf.fr`) — auto-entrepreneur portal, FAQ pages, legal notices.
- **service-public.gouv.fr** — freelancer and business sections.
- **impots.gouv.fr** — tax sections for BNC, BIC, TVA intra-communautaire, freelancer-specific guides.
- **BOFiP-Impôts** (`bofip.impots.gouv.fr`) — official administrative doctrine.
- **Légifrance** — raw legal texts when needed.
- **CIPAV / SSI / CPAM** — pages relevant to freelancer retirement and social security.
- **Official PDF guides** (e.g., "Guide du micro-entrepreneur" published annually).

**My rules:**
- Scrape only what robots.txt allows.
- Cache aggressively (one fetch per URL, committed to repo as Markdown snapshots).
- Always store: `source_url`, `fetched_at`, `title`, `content`.
- Never present information without a citation. Ever.
- Always show the `fetched_at` date in the UI.

**Corpus targets:**
- v0.1: ~30 hand-picked URLs (the 30 most important pages for a new micro-entrepreneur).
- v0.2: ~200 URLs, auto-refreshed weekly.
- v1.0: ~500 URLs + ~20 official PDFs, refreshed weekly, plus a `/sources` page.

## 8. Architecture

```
User question (FR or EN)
        │
        ▼
  Next.js chat UI (streaming)
        │
        ▼
  /api/chat route
        │
        ├── 1. Detect language
        ├── 2. Rewrite query for retrieval
        ├── 3. Hybrid retrieve (pgvector ANN + Postgres tsvector BM25)
        ├── 4. Re-rank top-k (v0.2+)
        ├── 5. Guardrail check: high-stakes → disclaimer
        ├── 6. Build prompt with numbered citations
        ├── 7. Stream answer from Gemini via AI SDK
        ├── 8. Post-process: verify citations appear in context
        │
        ▼
  Response with [1][2] citations rendered as clickable source chips
```

```
Offline ingestion (scheduled script, weekly)
  public URLs list  ──►  fetch (respect robots.txt, rate limit)
                    ──►  parse (HTML / PDF → clean text)
                    ──►  chunk (~500 tokens, overlap 50, preserve headings)
                    ──►  embed (gemini-embedding-001)
                    ──►  upsert to Supabase (chunks + vectors + metadata + tsvector)
                    ──►  log to Langfuse (ingestion run trace)
```

## 9. Roadmap — three versions

**Rule: I don't move to the next version until the previous one is shipped.**

### v0.1 — "ugly but shipped" (target: end of week 3)

- [ ] Git repo created, Next.js bootstrapped, pushed to GitHub ✅
- [ ] Basic chat UI (textarea + button + message list — no streaming, no styling)
- [ ] Initial corpus: 30 URLs fetched and stored as Markdown snapshots *(5 done)*
- [ ] Ingestion script that chunks + embeds + upserts to Supabase pgvector
- [ ] `/api/chat` route: embed question → top-5 chunks → stuff into prompt → call Gemini → return text
- [ ] Every answer includes at least one citation with a link
- [ ] Deployed on Vercel
- [ ] README with one screenshot and one paragraph
- [ ] Answers 5 pre-chosen questions correctly (manual check)

**Ship gate:** a friend opens the URL, asks a question, gets a cited answer. Ugly is fine. **SHIP.**

### v0.2 — "real RAG" (target: end of week 5)

- [ ] Streaming responses via AI SDK v6
- [ ] Hybrid search: pgvector + Postgres `tsvector` full-text, RRF fusion
- [ ] Query rewriting step
- [ ] Full corpus (~200 URLs) via scheduled script
- [ ] PDF ingestion (at least 3 official guides)
- [ ] Citations rendered as clickable source chips
- [ ] Eval harness: 30 Q&A test pairs, scored accuracy
- [ ] shadcn/ui polish, responsive layout
- [ ] EN/FR i18n toggle via `next-intl`
- [ ] `/sources` page listing every source with fetched date

**Ship gate:** someone reads the README and understands what this is in 60 seconds.

### v1.0 — "flagship ready" (target: end of week 7)

- [ ] Langfuse observability (traces, costs, latencies)
- [ ] Re-ranker step
- [ ] Hallucination guardrail: no relevant chunks → "I don't know"
- [ ] High-stakes disclaimer on flagged topics
- [ ] Eval report published to `/eval` page
- [ ] Architecture diagram + screenshots in README
- [ ] Demo access gate to protect LLM quota
- [ ] Article published on elgote.com
- [ ] Domain purchased and DNS pointed
- [ ] Public launch (LinkedIn + X + dev.to + HN Show)

**Ship gate:** I'd show this to a client without flinching.

## 10. Weekly schedule

~2h weekday evenings + 6h weekends ≈ 16h/week.

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Scaffold + data spike | Repo, Next.js + Supabase set up, 30-URL corpus |
| 2 | Ingestion + retrieval + dumb chat | Full pipeline works locally |
| 3 | Deploy + README + **SHIP v0.1** | Public URL, 5 Q&A verified |
| 4 | Corpus expansion + PDF ingestion + hybrid search | v0.2 pipeline |
| 5 | Streaming + citations + i18n + eval + **SHIP v0.2** | Eval scores logged |
| 6 | Langfuse + re-ranker + guardrails + eval page | v1.0 infra |
| 7 | Article + diagram + launch + **SHIP v1.0** | Article published, announced |

**If a week slips:** cut from v0.2/v1.0, never from v0.1.

## 11. Directory layout

```
<project>/
├── PLAN.md
├── README.md
├── web/                     ← Next.js app
│   ├── app/
│   │   ├── api/chat/route.ts
│   │   ├── [locale]/page.tsx
│   │   └── layout.tsx
│   ├── components/
│   ├── lib/
│   │   ├── rag/
│   │   │   ├── ingest.ts
│   │   │   ├── chunk.ts
│   │   │   ├── embed.ts
│   │   │   ├── retrieve.ts
│   │   │   ├── rerank.ts
│   │   │   └── prompt.ts
│   │   └── db.ts
│   └── messages/
│       ├── en.json
│       └── fr.json
├── data/
│   ├── sources/             ← fetched public pages (MD + YAML frontmatter)
│   └── pdfs/                ← downloaded official PDFs
├── scripts/
│   ├── fetch_sources.ts
│   └── ingest.ts
└── eval/
    ├── test_set.json
    └── run_eval.ts
```

## 12. Learning goals

- **v0.1:** understand every line. Write chunking, embedding, similarity search myself. No LangChain. If someone asks "how does RAG work?", I can draw the diagram on a napkin.
- **v0.2:** understand why hybrid search beats pure vector. Read one paper on RRF. Measure it on my own eval set.
- **v1.0:** understand observability and eval in production. Set up Langfuse, watch real traces.

## 13. Open questions

- AI Gateway for provider fallback, or direct Gemini for v0.1? → decide at v0.2.
- Supabase client vs direct `postgres.js`? → decide day 1.
- Langfuse cloud vs self-hosted? → decide at v1.0.
- Project name? → decide before v1.0 launch.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope creep before v0.1 | Re-read section 5 weekly. |
| Perfectionism blocks launch | Commit to week-3 ship date, tell a friend. |
| LLM free tiers change | Wire 2 providers, abstract behind AI SDK at v0.2. |
| Wrong-answer liability | Hard disclaimer on every answer. Every answer cited. No personalized advice. |
| Official sources change / move | Snapshots with `fetched_at`, detect diffs on re-run. |
| robots.txt / ToS issues | Only public pages, respect robots.txt, rate-limited. |
| Generic "chat with PDFs" feel | Domain-specific UX: quick-question chips, cited chips, "last updated" badge. |

---

*Plan v2.0 — 2026-04-12. Updated as decisions are made.*
