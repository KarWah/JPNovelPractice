# Japanese Learning Tool

A personal Japanese vocabulary SRS (spaced-repetition) app built around the the ability to import light novel series. Vocabulary is scraped directly from the novels, enriched with JMdict data, and reviewed with an SM-2 algorithm — similar in spirit to [JPDB](https://jpdb.io) or Anki, but tailored to a specific reading list.

## Features

- **Novel-based vocab lists** — scrape vocabulary from any Syosetu/web-novel URL; each novel has its own word list and progress tracking
- **SM-2 spaced repetition** — four-grade review (Again / Hard / Good / Easy); "Again" cards re-queue within the same session up to twice before being written back
- **JMdict enrichment** — fills readings, meanings, parts of speech, and JLPT level for every word
- **Kanji dictionary** — separate KANJIDIC import for per-kanji detail pages
- **Tatoeba example sentences** — import example sentences for enriched words
- **Cross-novel blacklist** — automatically (or manually) skip words you already know from other novels
- **Analytics** — 7-day review chart, JLPT breakdown, daily streak
- **AI tutor drawer** — context-aware chat via a local Ollama model
- **PWA** — installable, service-worker backed

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4 |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | PostgreSQL 15 (Docker) |
| Scraping | Python (`Scrape.py`, Beautiful Soup) |
| Enrichment | Python (`scripts/jmdict_enrich.py`, `scripts/kanjidic_import.py`) |
| AI | Ollama (local LLM, streamed NDJSON) |

## Prerequisites

- Node.js 20+
- Python 3.10+
- Docker + Docker Compose

## Setup

### 1. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 15 at `localhost:5432` (`seishun_db` / `postgres` / `localpassword`).

### 2. Install dependencies

```bash
cd seishun-srs-app
npm install
```

### 3. Configure environment

Create `seishun-srs-app/.env`:

```env
DATABASE_URL=postgresql://postgres:localpassword@localhost:5432/seishun_db
OLLAMA_BASE_URL=http://localhost:11434
```

### 4. Run migrations and seed

```bash
# from seishun-srs-app/
npx prisma migrate deploy
npm run db:seed          # seeds from ../seishun_buta_vocab.json (~17k words)
```

### 5. Enrich vocabulary (optional but recommended)

```bash
# from repo root
python scripts/jmdict_enrich.py          # readings, meanings, JLPT, POS
python scripts/kanjidic_import.py        # kanji entries
python scripts/jmdict_enrich.py --examples  # Tatoeba example sentences
```

JMdict/KANJIDIC data is downloaded and cached to `scripts/.cache/` on first run.

### 6. Run the dev server

```bash
cd seishun-srs-app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
Jap_test/
├── docker-compose.yml          # PostgreSQL service
├── Scrape.py                   # Novel scraper (accepts --url and --output)
├── seishun_buta_vocab.json     # Pre-scraped vocabulary seed data
├── scripts/
│   ├── jmdict_enrich.py        # JMdict + Tatoeba enrichment
│   └── kanjidic_import.py      # KANJIDIC kanji import
└── seishun-srs-app/            # Next.js application
    ├── app/
    │   ├── page.tsx            # Novel selection landing
    │   ├── novel/[id]/         # Per-novel dashboard
    │   ├── novels/new/         # Add novel (scrape form)
    │   ├── study/              # Study session
    │   ├── vocab/              # Browse & word detail
    │   ├── analytics/          # Global analytics
    │   └── api/                # API routes
    ├── components/             # Shared UI components
    ├── lib/
    │   ├── types.ts            # Shared DTOs
    │   ├── jp.ts               # Japanese utilities, JLPT helpers
    │   ├── srs.ts              # SM-2 algorithm
    │   ├── furigana.ts         # Furigana parser
    │   ├── repositories/       # DB query layer
    │   └── services/           # Blacklist service
    └── prisma/
        ├── schema.prisma
        └── migrations/
```

## Key Notes

- **Prisma 7**: the datasource in `schema.prisma` has no `url` field — the connection string lives in `prisma.config.ts` and is passed via `PrismaPg` adapter at client construction time.
- **Furigana format**: bracket notation `[漢字](かんじ)` used throughout.
- **Vocab data**: all seed entries store the word form in `kana`; `allReadings[0]` is the canonical reading after enrichment.
