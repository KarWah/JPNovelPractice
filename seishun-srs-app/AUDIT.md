# Seishun SRS — Codebase Audit

> Audited: 2026-04-14. All line references are to the state of the repo at that date.

---

## Bugs (confirmed & fixed)

### BUG-1 — AI furigana renders as navigable links `[FIXED]`
**File:** `components/TutorDrawer.tsx` — `AssistantMessage`

The AI is instructed to format Japanese words with bracket/paren furigana notation: `[Kanji](かんじ)`. This is identical to Markdown link syntax. `ReactMarkdown` renders it as `<a href="かんじ">Kanji</a>`. Clicking any highlighted word in the AI response navigates the browser to the kana reading as a relative URL (e.g. `http://localhost:3000/き`), which 404s.

**Fix applied:** Override the `a` component renderer. If the `href` is purely hiragana/katakana (`/^[\u3040-\u30FF]+$/`), render a `<ruby>` element with the kana as `<rt>` instead of a link. Real external links still work normally.

---

### BUG-2 — Quick question buttons never send `[FIXED]`
**File:** `components/TutorDrawer.tsx` lines ~195–205

The quick-question pill buttons did:
```tsx
onClick={() => {
  setInput(q);
  setTimeout(() => send(), 0);
}}
```
`setInput(q)` is asynchronous (React state update). The `send` callback is a `useCallback` that closes over the render-time `input` value. By the time `setTimeout` fires `send()`, the closure still holds the *old* `input` (empty string), so `question.trim()` is `""` and `send` returns early — nothing is sent.

**Fix applied:** `send` now accepts an optional `directQuestion?: string` parameter. When provided it is used instead of the `input` state. Quick question buttons now call `send(q)` directly, bypassing the state entirely.

---

## Bugs (confirmed, not yet fixed)

### BUG-3 — Prev/Next vocab navigation is non-deterministic
**File:** `app/vocab/[id]/page.tsx` lines 36–47

`prevEntry` / `nextEntry` are found by `occurrences: { gt/lt: n }` with no secondary sort key. Multiple words sharing the same occurrence count make `findFirst` return an arbitrary row. Navigating prev/next repeatedly can cycle the same word or skip others.

**Fix:** Add `{ id: "asc" }` as a tiebreaker in both `orderBy` arrays:
```ts
orderBy: [{ occurrences: "asc" }, { id: "asc" }],
// and
orderBy: [{ occurrences: "desc" }, { id: "desc" }],
```

---

### BUG-4 — Analytics page date bucketing has a UTC/local-time mismatch
**File:** `app/analytics/page.tsx` lines 36–44

`reviewedAt.toISOString().slice(0, 10)` produces a UTC date. The comparison date keys are also built with `toISOString()` so this is internally consistent — **but only when the server runs in UTC**. On a server with a local timezone ahead of UTC (e.g. AEST UTC+10) a review logged at 23:00 local time is stored in the DB at 13:00 UTC the day before, causing it to bucket to the wrong bar in the chart.

**Fix:** Use `toLocaleDateString("en-CA")` (yields `YYYY-MM-DD` in local time) consistently for both the log bucketing and the dayMap key generation, or run Postgres with `timezone = 'UTC'` and keep everything UTC.

---

### BUG-5 — Study session TutorDrawer retains chat history across cards
**File:** `app/study/StudySession.tsx` lines 256–264

`<TutorDrawer vocabContext={...} />` is mounted once for the whole session. When the card advances the `vocabContext` prop updates (new word), but `messages` state inside the drawer is never reset. Old conversation about word A persists while the header now shows word B — confusing.

**Fix:** Add a `useEffect` inside `TutorDrawer` that clears `messages` when `vocabContext.word` changes:
```tsx
useEffect(() => { setMessages([]); }, [vocabContext?.word]);
```

---

## Issues / Improvements

### ISSUE-1 — `getLearnedVocabIds` is called twice in `getNovelStats`
**File:** `lib/repositories/vocab.ts` lines 28–35

`getNovelStats` calls `getLearnedVocabIds` on line 28, then calls `getNewWords` on line 29, which internally calls `getLearnedVocabIds` again — two identical `UserProgress.findMany` queries per dashboard load.

**Improvement:** Accept an optional `learnedIds` parameter in `getNewWords` (or inline the second query) so the result from the first call is reused.

---

### ISSUE-2 — Service Worker has no offline fallback
**File:** `public/sw.js` lines 23–37

The fetch handler is network-first with no catch: `event.respondWith(fetch(request))`. If the network is unavailable the request fails with a network error rather than falling back to the cached shell. The PRECACHE entries are wasted.

**Improvement:**
```js
event.respondWith(
  fetch(request).catch(() => caches.match(request))
);
```

---

### ISSUE-3 — `spawn` uses `shell: true` unnecessarily
**File:** `app/api/novels/scrape/route.ts` line 41

`spawn("python", [...], { shell: true })` passes arguments through a shell interpreter. The URL is validated to start with `https://jpdb.io/` but `shell: true` is still an unnecessary attack surface. Arguments are already provided as an array, so the shell isn't needed.

**Improvement:** Remove `shell: true`. If `python` is not on PATH, use `python3` or make the interpreter path configurable via `.env`.

---

### ISSUE-4 — Cover upload blocks the event loop
**File:** `app/api/novels/[id]/cover/route.ts` line 46

`writeFileSync` in a Next.js API route blocks the entire Node.js event loop for the duration of the disk write.

**Improvement:** Use `import { writeFile } from "fs/promises"` and `await writeFile(...)`.

---

### ISSUE-5 — Streak breaks mid-day if no reviews yet
**File:** `app/analytics/page.tsx` lines 63–79

The streak counter starts from `today` and walks backwards. If the user hasn't studied yet today, the streak counter shows 0 even if they have a 30-day streak ending yesterday. Most SRS apps (Anki, Duolingo) count the streak as continuous until midnight if yesterday had reviews.

**Improvement:** Start the streak walk from yesterday if today has no reviews:
```ts
const startFrom = reviewedDays.has(todayKey) ? 0 : 1;
for (let i = startFrom; ; i++) { ... }
```

---

### ISSUE-6 — No auth layer — unsafe for public self-hosting
The app has no authentication. Every route, API endpoint, and action is publicly accessible. Deploying to a public IP/domain (for phone access from outside home) exposes your study data and allows anyone to grade cards, blacklist words, or import novels.

**Required before self-hosting externally:** See the roadmap section below.

---

### ISSUE-7 — Cover images stored in `public/assets/` are wiped by Next.js rebuilds
`writeFileSync` saves covers to `public/assets/`. On a server rebuild (or `next build`) the `.next` folder is recreated. `public/` itself persists, but if you ever `rm -rf` the project and re-clone, the images are gone. There is no migration or backup path.

**Improvement:** Store covers in a dedicated persistent directory outside the project root (e.g. `/var/data/seishun/covers/`) and serve them via a simple static file route or a bind-mount in Docker.

---

### ISSUE-8 — `addToStudyDeck` server action has no pending feedback
**File:** `app/vocab/[id]/page.tsx` — `StartStudyButton`

The form-based server action has no loading state. Clicking "Add to study deck" appears unresponsive for the network round-trip duration. Use `useFormStatus` (from `react-dom`) inside a client wrapper to show a spinner or disable the button while pending.

---

### ISSUE-9 — Vocab breadcrumb loses `novelId` context
**File:** `app/vocab/[id]/page.tsx` line 71

The breadcrumb links to `/vocab` without preserving `?novelId=X`. If you reached the detail page from `/vocab?novelId=1`, clicking "Vocabulary" in the breadcrumb drops the novel filter.

**Improvement:** Pass `novelId` as a prop to the detail page (it can be read from the entry's `novelId` field) and append it to the breadcrumb href.

---

## Self-Hosting Roadmap

Goal: access the app from your phone over the internet without being at home.

### Phase 1 — Local network access (LAN)

Already possible. Ensure Next.js listens on `0.0.0.0`:

```json
// package.json
"dev": "next dev --hostname 0.0.0.0 -p 3000"
```

Access from your phone on the same Wi-Fi at `http://192.168.x.x:3000`.

Ollama also needs to bind externally if you want AI on your phone:
```
OLLAMA_HOST=0.0.0.0 ollama serve
```

---

### Phase 2 — Authentication (required before internet exposure)

The simplest self-hostable auth for a single-user app:

**Option A — HTTP Basic Auth via Caddy/Nginx (easiest)**
Put a reverse proxy in front of Next.js that requires a username/password. No code changes needed.

Example Caddy snippet:
```
your.domain.com {
  basicauth {
    youruser <bcrypt hash>
  }
  reverse_proxy localhost:3000
}
```

Generate the hash: `caddy hash-password --plaintext yourpassword`

**Option B — Add NextAuth.js with credentials provider**
Requires adding `next-auth`, a `[...nextauth]/route.ts`, and wrapping protected routes in session checks. More work but gives you proper session cookies and the ability to add OAuth (Google, GitHub) later.

Recommended for a solo app: **Option A**. It's 10 lines of config and requires no changes to the codebase.

---

### Phase 3 — Internet access options

#### Option A — Port forwarding (simplest, no cloud cost)
1. Forward port 443 (or 80) on your home router to your PC
2. Set up a DDNS service (DuckDNS, No-IP) to give your dynamic IP a stable domain
3. Install Caddy for automatic HTTPS: `caddy run --config /etc/caddy/Caddyfile`

Caveats: your public IP changes when your ISP reassigns it (DDNS handles this), and your home connection must be up for the app to be reachable.

#### Option B — Cloudflare Tunnel (no port forwarding, no open ports)
1. Install `cloudflared` on your PC
2. `cloudflared tunnel create seishun-srs`
3. Route a subdomain of a Cloudflare-managed domain through the tunnel
4. Cloudflare handles HTTPS termination

This is the safest option: no inbound ports, DDoS protection, and Cloudflare Access can add a one-click auth layer.

#### Option C — VPS (most flexible, small monthly cost)
Deploy the app + DB to a cheap VPS (Hetzner CX11 ~€4/mo, Oracle Free Tier). Good if you want reliable uptime independent of your home connection. Requires Docker or manual deploy.

---

### Phase 4 — Docker Compose for reproducible deployment

The project already has a `docker-compose.yml` for the database. Extend it with a Next.js service:

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: localpassword
      POSTGRES_DB: seishun_db
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: ./seishun-srs-app
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:localpassword@db:5432/seishun_db
      OLLAMA_BASE_URL: http://host.docker.internal:11434
    depends_on:
      - db
    volumes:
      - covers:/app/public/assets   # persist cover images across rebuilds

volumes:
  pgdata:
  covers:
```

Add a `Dockerfile` to `seishun-srs-app/`:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

Enable standalone output in `next.config.ts`:
```ts
output: "standalone",
```

Then `docker compose up -d` handles the full stack.

---

### Phase 5 — Ollama on a remote host

If the server (VPS or home PC) running Next.js is different from the machine running Ollama, point `OLLAMA_BASE_URL` to the Ollama machine's LAN IP or a tunnelled address. Ensure Ollama is not exposed to the internet without auth — wrap it behind the same Caddy/Cloudflare layer, or keep it on a private network only reachable by the app server.

---

### Recommended path for your setup

Given you want to access from your phone outside home, and want to keep things simple:

1. **Now:** Run on `0.0.0.0` so your phone works on local Wi-Fi
2. **Next:** Set up Cloudflare Tunnel — zero config on your router, automatic HTTPS, add Cloudflare Access for auth (free tier)
3. **Later:** Move to Docker Compose for reproducible restarts after reboots
