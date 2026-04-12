# Flagship Project #1 — French Freelancer Admin RAG Assistant

> **Status:** planning complete, awaiting day-1 setup.
> **Codename:** TBD (candidates: URSSAFari, PaperBaguette, MicroBureau, ChargeChat, Urssafé). Pick when something clicks.
> **Target domain:** to be purchased when v0.1 ships (~€6/year).
> **Pivoted from:** an earlier catering-domain idea ("RAGuette") — killed because of optics conflict with Meet My Mama, which is already building a similar internal tool. This version has zero overlap.

---

## 1. Vision (in one paragraph)

A bilingual (FR/EN) AI assistant that answers the administrative and fiscal questions French freelancers (micro-entrepreneurs, professions libérales, auto-entrepreneurs, EURL/SASU founders) ask constantly and fail to get clear answers to. *"Can I invoice a foreign client in USD as a micro-entrepreneur?"*, *"What's the 2026 CA ceiling?"*, *"When do I have to switch to BNC réel?"*, *"How do I declare a client in Indonesia?"*, *"What's the ACRE reduction schedule?"*, *"Do I need to charge TVA to a Belgian company?"* Answers come grounded in official public sources (URSSAF, service-public.fr, impots.gouv.fr, BOFiP, Légifrance) with clickable citations, a clear "last updated" date per source, and a strong "ask an accountant for definitive advice" guardrail on high-stakes topics.

**Target user persona:** "Lucas, 28, just left his CDI to freelance as a React dev, three weeks into micro-entrepreneur status, drowning in acronyms (URSSAF, CFE, CFP, TVA, BNC, ACRE, CIPAV, SIRET, APE, BIC), no accountant yet because he can't afford one, panicking at every email from a `.gouv.fr` domain."

**Secondary persona:** "Aïcha, 35, freelance translator with international clients, fluent in English only, needs to understand French fiscal rules in English because every source she finds is in French."

## 2. Positioning

- **Genre:** Public-knowledge copilot for self-employed French workers. B2C-ish, but the pain is SMB-shaped.
- **Differentiators:** bilingual FR/EN (rare in this niche — French fiscal info in English is a wasteland), cited answers only, explicit "last updated" trail, explicit disclaimer flow on high-stakes topics, shows a *real* production RAG pipeline (hybrid search, re-ranking, eval harness, observability) not a toy.
- **Why this beats a "chat with URSSAF PDFs" demo:** real citations, real eval set, real guardrails, real bilingual handling, real observability. The portfolio story is "I treated this like a product, not a notebook."
- **Not in scope:** no tax *optimization* advice (liability landmine), no personalized financial planning, no account creation with government portals, no automation of actual filings.

## 3. Why this project, for Ismaïl, right now

- **You are the user.** You become a freelancer at Meet My Mama in a few months. Every improvement is a tool you'll personally use.
- **Zero overlap with Meet My Mama.** They do catering, you do fiscal admin — nobody can accuse you of cloning their product.
- **Public data.** No scraping ethics drama, no IP risk, no "where did you get this data" questions.
- **Huge target audience.** France has 2M+ micro-entrepreneurs, all confused, all Googling the same 50 questions. Organic demand is real.
- **SMB-adjacent.** Every SMB founder also navigates this stuff. The positioning message writes itself: *"I build AI tools for the administrative pain of small French businesses and the people who run them."*
- **Forces real RAG skills.** Citations aren't optional here — legal/fiscal answers *must* be grounded. Hallucinations are dangerous. This pushes you to build real guardrails, not vibe-check RAG.
- **Bilingual is a rare moat.** Almost nobody serves the English-speaking expat-freelancer market in France properly.
- **Monetizable later** (freemium, €5–10/month premium tier, referral to accountant platforms) without any ethical drama if you decide to go further.
- **Strong article material.** *"I built an AI assistant for URSSAF hell, here's what I learned about production RAG"*, *"Why French public data is gold for AI products"*, *"How I added real citations and cut hallucinations by 70%"*.

## 4. Success criteria

This project is "flagship quality" when ALL of the following are true:

- [ ] Deployed at a public URL, accessible without install (Vercel).
- [ ] Works end-to-end: a stranger asks 5 realistic questions and gets cited, correct answers in under 10 seconds each.
- [ ] Bilingual: UI has EN/FR toggle, assistant responds in the language of the question.
- [ ] Every answer has ≥1 inline citation linking back to an official public source.
- [ ] Every citation shows the source's "last fetched" date.
- [ ] High-stakes topics (tax thresholds, specific cases) trigger an explicit "this is general information, consult an accountant" disclaimer.
- [ ] Eval harness with ≥30 Q&A test pairs and a measurable accuracy score, iterated to improve.
- [ ] README so good a recruiter stops scrolling — screenshots, architecture diagram, live link, "how it works" section, eval results.
- [ ] At least one public article published on elgote.com telling the build story (in English).
- [ ] Codebase is 100% English (code, comments, commits, README).

## 5. Non-goals (hard line in the sand)

To protect shipping, we explicitly say NO to:

- Personalized tax advice (liability landmine — explicit disclaimer instead).
- Actual filings / integrations with URSSAF / impots.gouv.fr portals.
- User authentication beyond a single hardcoded demo gate.
- Multi-tenant data, subscriptions, payments, Stripe.
- Admin UI for uploading docs — data is seeded from scraped/downloaded public sources via scripts.
- Mobile app. Responsive web only.
- Voice I/O.
- Image generation.
- Fine-tuning a custom model (maybe flagship #2).
- Slack / Teams / WhatsApp integrations.
- Chat memory / conversation history across sessions (v1.0 is stateless per session).

If any of these come up before v1 ships, the answer is "flagship #2 or later."

## 6. Tech stack (free-tier only — locked)

| Layer | Choice | Why | Cost |
|---|---|---|---|
| **Frontend** | Next.js 16 App Router + TypeScript | Ismaïl already knows it (elgote.com), 1-click deploy | Free |
| **Hosting** | Vercel | Native Next.js, generous free tier | Free |
| **UI** | shadcn/ui + Tailwind | Fast, professional, not AI-slop | Free |
| **Chat / streaming** | Vercel AI SDK v6 + `@ai-sdk/react` | Industry standard in 2026 | Free |
| **LLM** | Gemini free tier (primary), Groq/Llama (fallback) | Both have real free tiers, multilingual-strong | Free |
| **Embeddings** | `gemini-embedding-001` or Nomic via Ollama local | Multilingual, free | Free |
| **Vector DB** | pgvector on Supabase | Ismaïl already uses Supabase, real production pattern | Free |
| **Relational DB** | Same Supabase Postgres | One DB = simpler, hybrid search friendly | Free |
| **i18n** | `next-intl` | Standard for Next.js App Router, route-based locales | Free |
| **Observability** | Langfuse (cloud free tier or self-hosted Docker) | Real RAG needs observability, great portfolio signal | Free |
| **Eval** | Custom script + Langfuse datasets (or Promptfoo) | Show you know how to measure, not vibe-check | Free |
| **Scraping / ingestion** | Plain `fetch` + `cheerio` + `pdf-parse` | Public official pages only, respect robots.txt | Free |
| **Domain** | `*.vercel.app` → real domain when v0.1 ships | €6 deferred | €6 deferred |

**Explicitly NOT using:**
- ❌ LangChain / LlamaIndex — too much magic, hides the pipeline, bad for learning. We write the pipeline ourselves. You learn RAG by *building* RAG, not by calling `chain.run()`.
- ❌ Pinecone / Weaviate Cloud — unnecessary when pgvector is right there.
- ❌ OpenAI — paid, and Gemini/Groq free tiers cover us.

## 7. The data strategy (the secret weapon)

Unlike the old catering idea, this project uses **100% real public data**. That is the whole point — real sources, real citations, real value.

**Sources (all legally scrapeable, all public, all official):**

- **URSSAF**: `urssaf.fr` — the auto-entrepreneur portal, FAQ pages, legal notices.
- **service-public.fr** — freelancer and business sections, especially the "Entreprise" vertical.
- **impots.gouv.fr** — tax sections for BNC, BIC, TVA intra-communautaire, freelancer-specific guides.
- **BOFiP-Impôts** (`bofip.impots.gouv.fr`) — official administrative doctrine, very dense, gold for citations.
- **Légifrance** — raw legal texts for specific articles when needed.
- **CIPAV / SSI / CPAM** pages relevant to freelancer retraite and sécu.
- **Official PDF guides** (e.g., "Guide du micro-entrepreneur" published annually).

**Hard rules:**
- Scrape only what robots.txt allows.
- Cache aggressively (one fetch per URL, committed to repo as JSON/MD snapshots).
- Always store: `source_url`, `fetched_at`, `title`, `content`, `hash`.
- Never present information without the citation. Ever.
- Always show the `fetched_at` date in the UI so users know what's current.

**Initial corpus target (v0.1):** ~30 URLs manually curated — the 30 most important pages for a new micro-entrepreneur. This is enough to prove the pipeline.

**v0.2 target:** ~200 URLs, auto-refreshed weekly via a scheduled script.

**v1.0 target:** ~500 URLs + ~20 official PDFs, refreshed weekly, plus a `/sources` page listing every source with its last-fetched date.

## 8. Architecture (high level)

```
User question (FR or EN)
        │
        ▼
  Next.js chat UI (streaming)
        │
        ▼
  /api/chat route
        │
        ├── 1. Detect language (simple heuristic or small LLM)
        ├── 2. Rewrite query for retrieval (LLM — expand + normalize)
        ├── 3. Hybrid retrieve (pgvector ANN + Postgres tsvector BM25)
        ├── 4. Re-rank top-k (v0.2+)
        ├── 5. Guardrail check: high-stakes detection → disclaimer injection
        ├── 6. Build prompt with numbered citations
        ├── 7. Stream answer from Gemini via AI SDK
        ├── 8. Post-process: verify citations actually appear in context
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

## 9. Roadmap — three versions, strictly sequential

**Rule: do NOT move to the next version until the previous one is shipped and committed.**

### v0.1 — "ugly but shipped" (target: end of week 3)

Goal: prove the full pipeline end-to-end, publicly, even if it looks bad.

- [ ] Git repo created, Next.js bootstrapped, pushed to GitHub
- [ ] Basic chat UI (textarea + button + message list — no streaming, no styling)
- [ ] Initial corpus: 30 hand-picked URLs from urssaf.fr + service-public.fr, fetched and stored as Markdown snapshots in `/data/sources/`
- [ ] Ingestion script that chunks + embeds + upserts to Supabase pgvector
- [ ] `/api/chat` route: embed question → top-5 chunks → stuff into prompt → call Gemini → return text
- [ ] Every answer includes at least one citation with a link to the original URL
- [ ] Deployed on Vercel
- [ ] README with one screenshot and one paragraph
- [ ] Answers 5 pre-chosen questions correctly (manual check, no eval harness yet)

**Ship gate:** a friend can open the URL, ask a question, and get a cited answer. If it looks ugly, that's fine. **SHIP.**

### v0.2 — "real RAG" (target: end of week 5)

Goal: upgrade from toy to credible production RAG.

- [ ] Streaming responses via AI SDK v6
- [ ] Hybrid search: pgvector + Postgres `tsvector` full-text, RRF fusion
- [ ] Query rewriting step (LLM expands/reformulates before retrieval)
- [ ] Full corpus (~200 URLs), ingested via scheduled script
- [ ] PDF ingestion (at least 3 official guides)
- [ ] Citations rendered as clickable source chips with favicons
- [ ] Basic eval harness: 30 Q&A test pairs in JSON, script scores accuracy
- [ ] shadcn/ui polish, responsive layout
- [ ] EN/FR i18n toggle on the UI via `next-intl`
- [ ] Assistant answers in user's language (system prompt instruction)
- [ ] `/sources` page listing every source with fetched date

**Ship gate:** someone who doesn't know you reads the README and understands what this is in 60 seconds.

### v1.0 — "flagship ready" (target: end of week 7)

Goal: make it the kind of project that lands a freelance client.

- [ ] Langfuse observability wired in (traces, costs, latencies per stage)
- [ ] Re-ranker step (free model, e.g. BGE-reranker via HF Space)
- [ ] Hallucination guardrail: if no chunks above similarity threshold → "I don't know, try rephrasing"
- [ ] High-stakes detection: flagged topics (tax thresholds, specific cases) prepend an explicit disclaimer
- [ ] Eval harness report generated on every deploy, published to `/eval` page
- [ ] Architecture diagram + screenshots in README
- [ ] Demo access gate (one hardcoded password OR rate-limit by IP) to protect LLM quota
- [ ] Article #1 published on elgote.com: *"Building an AI assistant for French freelancer admin — what I learned about production RAG"*
- [ ] Purchase domain, point DNS
- [ ] Announce publicly (LinkedIn + X + dev.to + HN Show)

**Ship gate:** you'd show this to a €500 TJM client without flinching.

## 10. Week-by-week schedule

Assuming ~2h weekday evenings + 6h per weekend ≈ 16h/week.

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Scaffold + data spike | Repo, Next.js + Supabase set up, 30-URL corpus fetched and saved as Markdown |
| 2 | Ingestion + retrieval + dumb chat | Full pipeline works locally, no UI polish |
| 3 | Deploy + README + **SHIP v0.1** | Public URL, 5 Q&A manually verified |
| 4 | Corpus expansion + PDF ingestion + hybrid search | v0.2 pipeline upgrades |
| 5 | Streaming + citations + i18n + eval harness + **SHIP v0.2** | Public URL updated, eval scores logged |
| 6 | Langfuse + re-ranker + guardrails + eval page | v1.0 infra |
| 7 | Article draft + diagram + launch + **SHIP v1.0** | Article published, LinkedIn post, GitHub pinned |

**Slippage policy:** if a week slips, v0.1 stays non-negotiable. Cut from v0.2/v1.0 before cutting v0.1.

## 11. Directory layout (created on day 1)

```
<project>/
├── PLAN.md                  ← this file
├── README.md                ← written at end of v0.1
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
│   └── messages/            ← next-intl translations
│       ├── en.json
│       └── fr.json
├── data/
│   ├── sources/             ← fetched public pages (MD + metadata JSON)
│   └── pdfs/                ← downloaded official PDFs
├── scripts/
│   ├── fetch_sources.ts     ← respects robots.txt, rate-limited
│   └── ingest.ts            ← runs chunk/embed/upsert against /data
└── eval/
    ├── test_set.json        ← 30 Q&A pairs
    └── run_eval.ts
```

## 12. Learning goals per version

- **v0.1:** understand every line. Write chunking, embedding, similarity search yourself. No LangChain. Goal: if a client asks "how does RAG work?", you draw the diagram on a napkin.
- **v0.2:** understand why hybrid search beats pure vector. Read one paper on RRF. Measure it on your own eval set. Write a paragraph for the article explaining what you learned.
- **v1.0:** understand observability and eval in production. Set up Langfuse, watch real traces, understand how people debug RAG in production.

Each version also funds a **Friday recall** session — close Claude, re-type one key function from memory. 15 minutes, no skipping.

## 13. Open questions (park, decide later)

- AI Gateway (`@ai-sdk/provider/ai-gateway`) for provider fallback, or direct Gemini for v0.1 simplicity? → decide at v0.2.
- Supabase client vs direct `postgres.js`? → decide day 1.
- Langfuse cloud vs self-hosted Docker? → decide at v1.0.
- Real domain name? → decide just before v1.0 launch (naming should feel obvious by then).

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope creep before v0.1 ships | Re-read section 5 (non-goals) weekly. |
| Perfectionism blocks v0.1 launch | Commit publicly to week-3 ship date, tell a friend. |
| LLM free tiers change mid-build | Wire 2 providers early, abstract behind AI SDK at v0.2. |
| Legal/fiscal wrong-answer liability | Hard disclaimer on every answer, especially high-stakes. Every answer cited. No personalized advice. |
| Official sources change / pages move | Store snapshots with `fetched_at` + hash, detect diffs on re-run. |
| robots.txt / ToS issues | Only public pages, respect robots.txt, rate-limited, conservative UA string. |
| Claude writes all the code, no learning | Friday recall habit. For v0.1 retrieval function, write it yourself BEFORE asking Claude. |
| Generic "chat with PDFs" feel | Domain-specific UX: quick-question chips ("TVA intracom?", "CA ceiling 2026?"), cited chips, "last updated" badge. |

## 15. What we do next (immediately after this plan is approved)

1. Confirm the plan (you read it, push back on anything that feels wrong).
2. Day-1 setup session: create GitHub repo, scaffold Next.js inside `web/`, create Supabase project, fetch first 5 URLs as Markdown snapshots.
3. No code before step 1. Plan first, code second.

---

*Plan v2.0 — pivoted 2026-04-12 from the earlier catering direction after Ismaïl flagged the overlap with Meet My Mama's own RAG chatbot project. Stack, roadmap, and ship discipline carried over; domain replaced with French public fiscal/admin data. Update this file as decisions change — commit updates so future-you sees how thinking evolved.*
