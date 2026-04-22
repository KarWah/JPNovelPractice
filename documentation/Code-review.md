# Code Review — Seishun SRS App

> A deep-dive into **what** every file does, **why** it was built that way, and **what else you could have done instead**.  
> Written for Karl to learn the code, not just trust it.

---

## Table of Contents

1. [Architecture overview](#1-architecture-overview)
2. [App shell & styling](#2-app-shell--styling)
3. [Routes — the user journey](#3-routes--the-user-journey)
4. [API routes](#4-api-routes)
5. [Shared library](#5-shared-library)
6. [Persistence layer](#6-persistence-layer)
7. [Enrichment scripts (Python)](#7-enrichment-scripts-python)
8. [Gaps & honest flags](#8-gaps--honest-flags)
9. [File-map cheat sheet](#9-file-map-cheat-sheet)

---

## 1. Architecture overview

Before diving into individual files, these five design decisions shape *everything* in the app. Understanding them makes every other choice click.

### 1.1 Server components by default, `"use client"` only at the leaves

Next.js 13+ introduced **React Server Components (RSC)**. A server component runs exclusively on the server, can call Prisma directly, and sends only HTML to the browser — no JavaScript bundle, no hydration. It's the default for any file under `app/` that doesn't start with `"use client"`.

The app follows a strict "RSC by default" posture:

| Component type | Runs on | Has JS bundle | Can call Prisma |
|---|---|---|---|
| Server component | Server only | No | Yes |
| Client component (`"use client"`) | Server (for initial HTML) + Client | Yes | No |

The result: most page components have zero client JavaScript. Only the four true interactive leaves need it — the novel grid (drag-and-drop), the study session (full state machine), the scrape form (SSE stream), and the vocab filters (URL manipulation). Everything else — stat cards, novel dashboards, vocab detail pages, analytics — is pure server-rendered HTML.

**Why this matters for you:** when you see `"use client"` at the top of a file, that's a deliberate boundary decision, not a default. It means *this component specifically needs browser APIs, hooks, or event handlers.* If you're adding a new component and it doesn't need any of those, leave it as a server component.

**Alternatives:**
- The old Next.js Pages Router had no RSC — everything was either SSR with `getServerSideProps` or CSR with `useEffect` fetching. The new model is strictly better for this app because Prisma calls never leave the server.
- You could mark every component as `"use client"` and essentially use Next like a Create React App with SSR. Works, but ships unnecessary JS and loses the simplicity of server-side Prisma access.

---

### 1.2 Three mutation styles, each chosen for a reason

The app mutates data in three different ways depending on the context:

**Style 1: Direct Prisma reads in RSC pages** — every list/detail page (`novel/[id]/page.tsx`, `vocab/[id]/page.tsx`, `analytics/page.tsx`, etc.) calls Prisma *directly in the page function*. There is no API layer in between. This is not lazy — it's the correct RSC pattern. The page IS the data-fetching logic.

**Style 2: Server actions** (`app/vocab/[id]/actions.ts`) — used for mutations on the vocab detail page (add to deck, blacklist, unblacklist). A server action is a function marked `"use server"` that can be passed as the `action` prop on a `<form>`. The browser submits the form, Next runs the function on the server, and `revalidatePath(...)` tells Next to re-render the affected page. Works with zero JavaScript (pure HTML form submit).

**Style 3: Route handlers** (`app/api/**`) — standard JSON API endpoints used when the client needs to call something programmatically with `fetch()`. Used for the study session (grading cards via `POST /api/review`), the novel grid (reordering via `PATCH /api/novels/reorder`), blacklisting during a session, and the scraping SSE stream.

**Why the split?** It depends on what happens after the mutation:
- If the page that initiated the mutation needs to re-render with fresh data → server action + `revalidatePath`.
- If the client wants to update its local state optimistically *without* a full re-render → route handler + `fetch`.
- If you just need to display data → read Prisma in the RSC body directly.

---

### 1.3 `force-dynamic` vs. param-driven rendering

Four pages export `export const dynamic = "force-dynamic"`:
- `app/page.tsx:6`
- `app/novel/[id]/page.tsx:11`
- `app/analytics/page.tsx:5`
- `app/novels/new/page.tsx` (implicit via SSE)

This tells Next: "always re-render this page on each request, never cache it."

Why only some pages? Because Next has *two* ways to go dynamic:
1. **Explicit** (`force-dynamic`) — you declare it.
2. **Implicit** — Next detects that you're reading `params`, `searchParams`, or request headers, and opts in automatically.

Pages like `vocab/page.tsx` (reads `searchParams`) and `vocab/[id]/page.tsx` (reads `params`) are automatically dynamic. The four that need `force-dynamic` don't read params but *do* serve user-mutable data that changes between requests (novel list, stats, review counts, analytics).

**Alternatives:**
- **Incremental Static Regeneration (ISR)**: cache the page but revalidate it every N seconds. Better for public-facing, high-traffic sites. For a personal app where you're the only user, per-request rendering is simpler.
- **`revalidateTag`**: tag Prisma writes with a cache key, invalidate it on mutation. More surgical but more complex to maintain — you have to remember to tag every write.

---

### 1.4 Suspense as a loading boundary AND a required wrapper

`<Suspense>` appears in four places. Two reasons:

**Reason 1 — Streaming:** `app/novel/[id]/page.tsx:138` wraps the dashboard content in Suspense so the page shell can flush to the browser *before* the three Prisma queries resolve. The user sees the layout immediately; the stats stream in afterward.

**Reason 2 — Required by Next for `useSearchParams`:** `StudySession` calls `useSearchParams()` (`StudySession.tsx:57`), and `VocabFilters` does too. Next 15 requires any client component using `useSearchParams` to be wrapped in a `<Suspense>` boundary, or the build fails. This is why `app/study/page.tsx` is nothing but a Suspense wrapper — it exists *specifically* to satisfy that requirement.

**Alternatives:**
- You could read search params from the server component's `searchParams` prop and pass them down. That means the client component doesn't need `useSearchParams` at all — and doesn't need the Suspense wrapper. Tradeoff: the parent has to pass more props, and URL changes require a round-trip to the server.

---

### 1.5 Streaming data: SSE and NDJSON via the same Web Streams idiom

Two different features stream data from server to client:

- **Scraping progress** uses SSE (Server-Sent Events) format: `data: {...}\n\n` per event.
- **Ollama AI responses** use NDJSON (Newline-Delimited JSON): one raw JSON object per `\n`.

Both are consumed by a virtually identical loop in the client component: `getReader()` on the response body → decode with `{ stream: true }` → maintain a buffer → split on the delimiter → JSON-parse each complete chunk.

The `{ stream: true }` flag on `TextDecoder` is important: it means the decoder holds incomplete multi-byte UTF-8 sequences across `read()` calls rather than replacing them with `?`. Without it, a Japanese character split across two TCP frames would be corrupted.

Neither uses the native `EventSource` API (which browsers provide specifically for SSE). Why? Because `EventSource` only supports GET requests. Both streams need POST bodies (the scrape URL, the chat question), so the browser's `fetch + ReadableStream` API is used instead.

---

### 1.6 Repository / service split

All database access lives under `lib/`:

- `lib/repositories/vocab.ts` — **read-only** queries (stats, review queue, new words). Pure data retrieval, no business logic.
- `lib/services/blacklist.ts` — **write** operations with **business rules** (the cross-novel overlap logic). Doesn't just run a query — it *decides* what to do.

This is a lightweight version of the Repository and Service patterns from domain-driven design. The practical benefit: API routes and server actions that need the same operation import the same function. `app/vocab/[id]/actions.ts:4` and `app/api/blacklist/route.ts` both import from `lib/services/blacklist`, so there's exactly one implementation of "blacklist a word."

---

## 2. App shell & styling

### 2.1 `app/layout.tsx` — Root layout (server component)

```tsx
// app/layout.tsx:6-15
const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

`next/font/google` downloads the font files at build time and self-hosts them from `/_next/static/`. No request to Google's servers at runtime. It exposes the font as a CSS variable (`--font-noto-jp`) rather than inlining a class name — so you can reference it in plain CSS too.

```tsx
// app/layout.tsx:28-37
<html
  lang="ja"
  className={`${notoSansJP.variable} ${geistMono.variable} h-full antialiased`}
>
  <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 font-[var(--font-noto-jp)]">
    <ServiceWorkerRegistrar />
    {children}
  </body>
</html>
```

**Why `lang="ja"`?** Screen readers and browser translation services use this to know the page's primary language. Omitting it means assistive tech defaults to whatever the OS language is.

**Why `font-[var(--font-noto-jp)]`?** Tailwind v4 arbitrary value syntax. It sets `font-family` to the CSS variable that `next/font` injected. Combined with the fallback stack in `globals.css:11` (`"Hiragino Sans", "Meiryo", sans-serif`), Japanese text renders correctly across macOS, Windows, and mobile.

**Why `ServiceWorkerRegistrar` as a component instead of an inline script?** Because the root layout is a server component, and server components can't run JavaScript on the client. `ServiceWorkerRegistrar` is a client component that renders `null` — it's a side-effect-only island purely for its `useEffect`. See §2.4.

**Alternatives:**
- Self-hosting fonts manually by downloading `.woff2` files and using `@font-face` in CSS. More control, same end result, more maintenance.
- Dark mode could be done with Tailwind's `darkMode: 'class'` toggle and a localStorage-persisted theme switch. That requires a client component in the layout, which makes the layout itself client-side (or requires a more complex RSC/client split). The `prefers-color-scheme` CSS approach keeps the layout a pure server component.

---

### 2.2 `app/globals.css` — Tailwind v4 theme

```css
/* app/globals.css:1-13 */
@import "tailwindcss";

:root {
  --background: #f9fafb;
  --foreground: #111827;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-noto-jp), "Hiragino Sans", "Meiryo", sans-serif;
  --font-mono: var(--font-geist-mono);
}
```

**`@import "tailwindcss"`** is Tailwind v4's single-import syntax. In v3, you needed three `@tailwind base/components/utilities` directives. v4 collapses all of that into one line. No `tailwind.config.js` is needed — configuration lives in CSS via `@theme`.

**`@theme inline`** is how you extend Tailwind v4's design tokens without a config file. It's the v4 replacement for `theme.extend` in `tailwind.config.js`. The `inline` keyword means these custom properties are inlined into every selector that uses them, rather than generating a separate `:root` block.

```css
/* app/globals.css:52-72 */
/* Range input — restore thumb on iOS Safari (appearance-none removes it) */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 9999px;
  background: #4f46e5;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
```

**Why hand-written CSS for the slider?** Tailwind's `appearance-none` removes all browser-default styling, including the draggable thumb, on iOS Safari. Tailwind has no built-in way to restyle pseudo-elements like `::-webkit-slider-thumb`. So this is raw CSS. Without it, the session-length slider in `SessionStarter` would be invisible on iPhones.

```css
/* app/globals.css:74-82 */
ruby { ruby-align: center; }
rt   { font-size: 0.55em; color: #e4e4e7; }
```

**Why global ruby styles?** The `FuriganaText` component (§3.5) emits `<ruby>` elements with inline Tailwind classes. But `TutorDrawer` (§3.11) renders furigana via `react-markdown`'s custom `a` renderer — that path produces `<ruby>` elements without any Tailwind classes. The global `rt` rule makes furigana readable in both code paths.

**Alternatives:**
- `@apply` inside a `.furigana` CSS class, then add that class to both renderers. Cleaner, but `@apply` in Tailwind v4 with `@theme inline` tokens has some caveats.
- CSS-in-JS (styled-components, emotion): would work, but adds a runtime dependency and complexity the app doesn't need.

---

### 2.3 `app/manifest.ts` — PWA manifest

```ts
// app/manifest.ts:28-39
shortcuts: [
  {
    name: "Study now",
    url: "/study",
    description: "Start a study session",
  },
  {
    name: "Browse vocab",
    url: "/vocab",
    description: "Browse all vocabulary",
  },
],
```

Next.js treats `app/manifest.ts` as a [file-based metadata route](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest). Exporting a function that returns a `MetadataRoute.Manifest` object causes Next to compile it to `/manifest.webmanifest` at build time. No static JSON file to maintain.

**Why `purpose: "maskable"` on icons?** Android's adaptive icon system crops icons into different shapes (circle, squircle, etc.) depending on the launcher. `maskable` signals that the icon has safe content in the center and can be cropped at the edges. Without it, Android may not crop nicely and will use the raw rectangle instead.

**Why `display: "standalone"`?** When the app is installed as a PWA, `standalone` removes the browser's URL bar and navigation buttons — it looks and feels like a native app. The alternative (`display: "browser"`) keeps the browser chrome but doesn't feel as native.

**Alternatives:**
- A static `public/manifest.json` file. Simpler, but no TypeScript type-checking and you'd have to manually update it.

---

### 2.4 `components/ServiceWorkerRegistrar.tsx` + `public/sw.js`

```tsx
// components/ServiceWorkerRegistrar.tsx:1-15
"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {/* SW registration is a progressive enhancement — fail silently */});
    }
  }, []);
  return null;
}
```

The service worker itself:

```js
// public/sw.js:7-37
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/")
  ) { return; }
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
```

**Three lifecycle events:**

- **`install`**: runs once when the SW is first registered. Pre-caches `["/", "/vocab", "/study"]`. `skipWaiting()` makes the new SW take over immediately rather than waiting for all tabs to close first.
- **`activate`**: runs once the SW is in control. Deletes any cache whose name doesn't match `CACHE` (`"seibusrs-v1"`). This is how versioning works: bump the constant to `"seibusrs-v2"` and the activate step cleans up the old cache automatically.
- **`fetch`**: intercepts every same-origin request. The three exclusions are critical:
  - Cross-origin: can't cache what's not yours.
  - `/api/`: these return dynamic data — stale API responses would be worse than a network error.
  - `/_next/`: Next's static assets use content hashes in their filenames, so the browser's native HTTP cache handles them better than the SW.

**Strategy: network-first, cache-fallback.** Try the network; if it fails (offline), serve from cache. This means online users always get fresh content. Offline users see whatever was pre-cached (the app shell).

**Why silent `.catch()`?** Service workers are a progressive enhancement. If the browser doesn't support them, or if the registration fails (e.g., wrong URL, CSP header), the app still works — it just won't work offline. Letting it crash would be wrong.

**Why `clients.claim()` in activate?** After a SW activates, it only controls pages opened *after* that point, not the one currently open. `clients.claim()` makes it take control of all open pages immediately, so the first-visit experience is consistent.

**Alternatives:**
- **Workbox** (Google's SW library): handles versioning, routing, and caching strategies with a higher-level API. Worth it for complex caching needs. Overkill for three pre-cached routes.
- **Next.js PWA plugin** (`@ducanh2912/next-pwa`): generates the SW automatically from your Next config. Less control, less to maintain.

---

## 3. Routes — the user journey

### 3.1 `app/page.tsx` — landing page (server component)

```tsx
// app/page.tsx:9-16
const novels = await prisma.novel.findMany({
  orderBy: { sortOrder: "asc" },
  include: {
    _count: { select: { vocabEntries: true } },
  },
});

const summaries = await Promise.all(novels.map((n) => getNovelSummary(n.id)));
```

Two things to notice:

**`_count: { select: { vocabEntries: true } }`** — this asks Prisma to include the count of related `vocabEntries` for each novel in the same query, rather than running N separate `COUNT` queries. Prisma translates it to a `GROUP BY` or subquery. If you had 20 novels and fetched the count separately per novel, you'd hit the DB 21 times. This hits it once.

**`Promise.all(novels.map(...))`** — fetches all novel summaries concurrently. Each `getNovelSummary` call runs three queries internally (`vocab/[id]/page.tsx` analogously runs five). Running them in sequence would be `O(n * 3)` round trips. In parallel: still 3 queries total per novel, but all novels' queries run simultaneously. The server doesn't wait for novel 1 to finish before asking for novel 2.

Then `app/page.tsx:44` renders `<NovelGrid initialNovels={items} />`. The grid is a client component for drag-and-drop — but it's pre-hydrated with `initialNovels`, so the first render is instant without any client-side fetch.

**Alternatives:**
- **Sequential fetching:** `for (const novel of novels) { summary = await getSummary(novel.id); }`. Simpler to read, significantly slower. Fine for 1 novel, unacceptable for 10.
- **Single SQL aggregate:** a raw Prisma query with multiple `COUNT FILTER (WHERE ...)` expressions in one statement. More performant but harder to read and ties your logic to raw SQL.

---

### 3.2 `app/novel/[id]/page.tsx` — novel dashboard (Suspense streaming)

```tsx
// app/novel/[id]/page.tsx:131-143
export default async function NovelDashboard({ params }: PageProps) {
  const { id } = await params;
  const novelId = parseInt(id);
  if (isNaN(novelId)) notFound();

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-10 gap-8">
      <Suspense fallback={<LoadingContent />}>
        <NovelDashboardContent novelId={novelId} />
      </Suspense>
    </div>
  );
}
```

**Why `await params`?** In Next.js 15+, `params` is now a `Promise<{ id: string }>` rather than a plain object. This change enables Next to start rendering the page shell before params are fully resolved, improving time-to-first-byte. You must `await` it.

**The Suspense split:** `NovelDashboard` is the *outer* shell — layout, spacing classes. It renders immediately. `NovelDashboardContent` is the *inner* data-heavy component — three parallel Prisma queries. By putting `NovelDashboardContent` inside `<Suspense>`, React can:
1. Send the outer shell HTML to the browser immediately (fast first paint).
2. Stream the inner content HTML as a "patch" once the Prisma queries resolve.

During the wait, `<LoadingContent />` (a pulsing skeleton at `page.tsx:117-129`) appears. Without Suspense, the entire page would wait for all three queries before sending any HTML.

```tsx
// app/novel/[id]/page.tsx:19-28
const [novel, stats, otherNovelProgress] = await Promise.all([
  prisma.novel.findUnique({ where: { id: novelId } }),
  getNovelStats(novelId),
  prisma.userProgress.count({ where: { vocab: { novelId: { not: novelId } } } }),
]);

const isNewNovel = stats.learnedCount === 0;
const hasKnownFromOtherNovels = isNewNovel && otherNovelProgress > 0;
```

**The cross-novel banner logic:** if the user has never studied this novel (`learnedCount === 0`) but *has* progress on other novels (`otherNovelProgress > 0`), show the `<CrossNovelSetup>` banner. This is the "you already know some of these words from your other novels — want to skip them?" feature. The condition is evaluated at page-render time: one extra count query that only runs once and has zero UI cost.

**`<CrossNovelSetup>` appears twice:**
- Line 65: as a banner (shown only when `isNewNovel && hasKnownFromOtherNovels`).
- Line 108: as a compact button inside "Advanced options" (always shown).

Same component, two visual modes controlled by the `showAsButton` prop. It's not duplicate code — it's one component with two layouts.

**Alternatives:**
- Fetch the cross-novel count client-side after load. Avoids the extra server query but introduces a loading state. Since it's a single COUNT query that resolves in milliseconds, doing it server-side is strictly better.

---

### 3.3 `components/StatCard.tsx` — metric tile (server component)

```tsx
// components/StatCard.tsx:8-16
export default function StatCard({ label, value, accent, sub }: StatCardProps) {
  const accentClass =
    accent === "indigo"
      ? "text-indigo-600 dark:text-indigo-400"
      : accent === "yellow"
      ? "text-yellow-600 dark:text-yellow-400"
      : accent === "green"
      ? "text-green-600 dark:text-green-400"
      : "text-zinc-800 dark:text-zinc-100";
```

**Why an if/else chain instead of `text-${accent}-600`?** Tailwind v4's JIT (just-in-time) compiler scans source files for class strings. It does not execute JavaScript — it uses a regex-like scanner. If you write `text-${accent}-600`, the scanner never sees the actual classes and won't include them in the final CSS. Writing out the full strings (`text-indigo-600`, `text-yellow-600`, etc.) ensures they're scanned and emitted. This is a rule you'll hit constantly with Tailwind.

No `"use client"` — this is a **server component** by default. It has no state, no events, no hooks. Every render is props-in, HTML-out. Since it's used in RSC parents (`analytics/page.tsx`, `novel/[id]/page.tsx`), keeping it a server component means no client JS is added for this component at all.

**Alternatives:**
- A lookup object: `const ACCENT_MAP = { indigo: "text-indigo-600 ...", ... }; accentClass = ACCENT_MAP[accent]`. Exactly the same end result, slightly more readable for many options.

---

### 3.4 `components/SessionStarter.tsx` — slider + start button (client)

```tsx
// components/SessionStarter.tsx:18-24
const effectiveMax = Math.min(SESSION_MAX, Math.max(maxAvailable, SESSION_MIN));
const defaultCount = Math.min(20, effectiveMax);
const [count, setCount] = useState(defaultCount);

const handleStart = () => {
  router.push(`/study?novelId=${novelId}&count=${count}`);
};
```

**Why `"use client"`?** Two reasons: `useState` for the slider value, and `useRouter()` for imperative navigation. Neither is available in a server component.

**The `effectiveMax` math:** `SESSION_MIN = 10`, `SESSION_MAX = 50`. If only 3 cards are available, `effectiveMax = Math.min(50, Math.max(3, 10)) = 10`. The slider still shows 10 as the max, but the label explains "Only 3 ready today." This prevents a broken zero-range slider.

**`useRouter().push` vs `<Link>`:** `<Link>` is for static navigation (you know the URL at render time). `router.push()` is for dynamic navigation (the URL depends on state — in this case, the slider value). Either would work here, but `push` is the right semantic since the URL is computed at click-time.

**Alternatives:**
- Use a `<form>` with `action="/study"` and a hidden input for the count. Pure HTML, no JS required. Tradeoff: form navigation does a full page load rather than a client-side transition.
- The slider could be a server component if you moved the count state up to the URL (e.g., a slider that auto-updates `?count=N` on change). But that would re-render the whole page on every slider drag — bad UX.

---

### 3.5 `components/FuriganaText.tsx` + `lib/furigana.ts` — ruby renderer

The parser in `lib/furigana.ts`:

```ts
// lib/furigana.ts:10-32
const RUBY_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export function parseFurigana(input: string): FuriganaToken[] {
  const tokens: FuriganaToken[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(RUBY_PATTERN)) {
    const [full, kanji, reading] = match;
    const start = match.index!;

    if (start > lastIndex) {
      tokens.push({ type: "text", text: input.slice(lastIndex, start) });
    }
    tokens.push({ type: "ruby", text: kanji, reading });
    lastIndex = start + full.length;
  }

  if (lastIndex < input.length) {
    tokens.push({ type: "text", text: input.slice(lastIndex) });
  }
  return tokens;
}
```

And the React component:

```tsx
// components/FuriganaText.tsx:10-27
export default function FuriganaText({ text, className }: FuriganaTextProps) {
  const tokens = parseFurigana(text);
  return (
    <span className={className}>
      {tokens.map((token, i) =>
        token.type === "ruby" ? (
          <ruby key={i}>
            {token.text}
            <rt className="text-xs text-zinc-500">{token.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{token.text}</span>
        )
      )}
    </span>
  );
}
```

**How the format works:** `[青春](せいしゅん)` is the bracket notation. The regex `/\[([^\]]+)\]\(([^)]+)\)/g` captures the kanji in group 1 and the reading in group 2. The tokenizer walks through the string: plain text between matches becomes `{ type: "text" }` tokens, and matches become `{ type: "ruby" }` tokens. The component maps each to either a `<span>` or a `<ruby><rt>` block.

**Why this notation and not HTML `<ruby>` stored in the DB?** Several reasons:
1. **JSON-safe**: angle brackets in JSON strings require escaping; square brackets don't.
2. **Human-readable**: a developer looking at the DB record can read `[私](わたし)` immediately.
3. **Renderer-agnostic**: the same string can become HTML `<ruby>`, plain text `(わたし)`, be stripped to `私` for search, or become TTS-friendly text — the format makes none of those choices in advance.
4. **Markdown-compatible**: it happens to be valid Markdown link syntax, which the `TutorDrawer` exploits (see §3.11).

**Why `"use client"` on `FuriganaText`?** Technically it shouldn't need to be — there are no hooks or browser APIs here. Marking it as a client component is conservative/defensive. It works either way; marking it as an RSC would shave a tiny amount from the client bundle.

**Alternatives:**
- **MeCab** or **Kuromoji**: morphological analyzers that auto-generate furigana for arbitrary Japanese text. Higher quality (handles okurigana edge cases correctly), but require a separate server or WASM bundle, and need to run at write-time not read-time.
- **Kuroshiro** (JS library): wraps Kuromoji, easier to use. Same tradeoffs.

---

### 3.6 `components/CrossNovelSetup.tsx` — two-mode component (client)

```tsx
// components/CrossNovelSetup.tsx:11-16
export default function CrossNovelSetup({ novelId, showAsButton = false }: CrossNovelSetupProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [blacklistedCount, setBlacklistedCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && !showAsButton) return null;
```

**The state machine:** `status` has three values — `"idle"`, `"loading"`, `"done"`. This is cleaner than multiple booleans (`isLoading`, `isDone`, `hasError`) that can combine into impossible states. With a union type, you can't be both `loading` and `done`.

**The `showAsButton` prop:** one component, two visual layouts. When `showAsButton = false` (the banner mode, shown on first visit), it renders a prominent indigo card. When `showAsButton = true` (the advanced-options mode, always visible), it renders inside a `<details>/<summary>` disclosure. The `dismissed` state only applies to the banner mode — `if (dismissed && !showAsButton) return null` reads: "hide only if dismissed AND we're in banner mode."

**`<details>/<summary>`:** HTML5's native disclosure widget. Click the summary, the `<details>` content appears. No JavaScript, no state, no ARIA attributes needed — the browser handles all of it, including keyboard navigation (Enter/Space toggles, included in the tab order automatically).

**Alternatives:**
- Split into two components (`CrossNovelBanner` and `CrossNovelButton`). Avoids the `showAsButton` prop. More explicit, slightly more code.
- A third-party disclosure component (Radix UI's `Collapsible`, HeadlessUI's `Disclosure`). More consistent design API, but adds a dependency.

---

### 3.7 `app/novels/new/NewNovelForm.tsx` — SSE scraping client

**The two-axis state machine:**

```tsx
// app/novels/new/NewNovelForm.tsx (approx :22-32)
const [status, setStatus] = useState<"idle" | "scraping" | "done" | "error">("idle");
const [phase, setPhase] = useState<"collecting" | "importing">("collecting");
```

`status` tracks the overall lifecycle. `phase` subdivides the `"scraping"` state because scraping JPDB (collecting) and importing to the DB (importing) show different UI messages. It's two dimensions rather than one 5-value enum because `phase` is only meaningful during `status === "scraping"`.

**The critical ordering decision:**

```tsx
// (approx :47-65)
const res = await fetch("/api/novels/scrape", { method: "POST", body: ... });

// Check for errors BEFORE switching to loading state
if (!res.ok) {
  const err = await res.json().catch(() => ({ error: "Failed to start scrape." }));
  setErrorMsg(err.error ?? "Unknown error.");
  setStatus("error");
  return;
}

// Only now enter the loading state
setStatus("scraping");
```

The POST is fired *before* the UI switches to "loading." Why? Because if the server returns a 409 (slug already taken), the form needs to show the error inline. If you switched to the loading state first, you'd have to unwind it on error, which is fiddly and looks broken.

**The SSE reading loop:**

```tsx
// (approx :72-108)
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split("\n\n");
  buffer = parts.pop() ?? "";

  for (const part of parts) {
    const dataLine = part.replace(/^data: /, "").trim();
    if (!dataLine) continue;
    try {
      const event = JSON.parse(dataLine);
      if (event.type === "progress") setScraped(event.scraped ?? 0);
      if (event.type === "done") setPhase("importing");
      if (event.type === "complete") { /* navigate */ }
      if (event.type === "error") { /* show error */ }
    } catch { /* incomplete chunk — ignore */ }
  }
}
```

**SSE framing vs. NDJSON framing:** SSE events are delimited by `\n\n` (double newline). Each event starts with `data: `. So after splitting on `\n\n`, each piece needs `.replace(/^data: /, "")` to extract the JSON payload. NDJSON (used by Ollama) uses single `\n` and no prefix — slightly different loop but the same idiom.

**`buffer = parts.pop()`:** after splitting on `\n\n`, the last element may be an incomplete event (TCP can deliver partial frames). Popping it back into `buffer` means the next `reader.read()` call will complete it.

**Cover upload as a second request:** after the SSE `complete` event, the client sends the cover image to `/api/novels/[id]/cover` as a multipart `FormData` POST. This is deliberate — keeping the SSE stream JSON-only (no binary blobs) simplifies the server's stream parser. Cover upload is optional and doesn't affect the scrape's success.

**Alternatives:**
- **Polling** (`GET /api/scrape/status/:jobId`): create a job record in the DB when the scrape starts, poll it every few seconds for progress. More reliable across reconnects, but requires a jobs table and more complex server logic.
- **WebSocket**: bidirectional, overkill for a one-way progress stream.
- **Long-polling**: one request blocks until there's progress, then you immediately fire another. Feels like streaming but is actually sequential requests. More complex than SSE for no benefit here.

---

### 3.8 `app/study/page.tsx` + `StudySession.tsx` — the review loop

**Why the wrapper page exists:**

```tsx
// app/study/page.tsx:1-16
import { Suspense } from "react";
import StudySession from "./StudySession";

export default function StudyPage() {
  return (
    <Suspense fallback={<p className="...">Loading session...</p>}>
      <StudySession />
    </Suspense>
  );
}
```

`StudySession` calls `useSearchParams()` on line 57 to read `?novelId=` and `?count=`. In Next 15, any client component using `useSearchParams` must be inside a `<Suspense>` boundary — otherwise the build warns and the whole route opts out of static analysis. `app/study/page.tsx` exists purely to provide that boundary. It has no other logic.

**Session persistence:**

```tsx
// StudySession.tsx:73-85
useEffect(() => {
  if (loading) return;
  const snapshot: SavedSession = {
    cards, current, revealed, stats,
    requeueCount: Array.from(requeueCount.current.entries()),
    sessionDone,
    savedAt: Date.now(),
  };
  try { sessionStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch { /* quota */ }
}, [cards, current, revealed, stats, sessionDone, loading, storageKey]);
```

This effect runs every time session state changes. It serializes the entire session to `sessionStorage` under a key like `srs:session:v1:1:20`. On mount (line 107-121), it tries to read that key back:

```tsx
// StudySession.tsx:107-121
useEffect(() => {
  const saved = readSavedSession(storageKey);
  if (saved) {
    setCards(saved.cards);
    setCurrent(saved.current);
    // ... restore all state ...
    setLoading(false);
  } else {
    loadCards();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Why `sessionStorage` not `localStorage`?** `sessionStorage` is cleared when the tab closes. That's the right scope for "one study session." If you used `localStorage`, a session snapshot from 3 days ago would restore when you open a new tab.

**Why the `eslint-disable-next-line`?** The `useEffect` has `[]` deps (run once on mount), but references `storageKey` and `loadCards`. Normally ESLint would complain that these should be in the deps array. But here it's intentional — we want this to run exactly once on mount, regardless of what `loadCards` captures. The disable comment documents this choice rather than hiding it.

**The Again re-queue logic (the most important non-obvious code in the app):**

```tsx
// StudySession.tsx:147-176
const fails = requeueCount.current.get(card.entry.id) ?? 0;
const shouldPersist = grade !== 1 || fails >= MAX_REQUEUES;

if (shouldPersist) {
  await fetch("/api/review", { method: "POST", body: JSON.stringify({ vocabId: card.entry.id, grade }) });
}

let updatedCards = [...cards];
if (grade === 1 && fails < MAX_REQUEUES) {
  requeueCount.current.set(card.entry.id, fails + 1);
  updatedCards.splice(current, 1);
  const insertAt = Math.min(current + 4, updatedCards.length);
  updatedCards.splice(insertAt, 0, card);
  advance(updatedCards, current < updatedCards.length ? current : 0);
} else {
  advance(updatedCards, current + 1);
}
```

**Why not persist every "Again"?** The SM-2 algorithm in `lib/srs.ts` treats grade 1 as "reset to relearn, next review in 1 day." If you press Again on a card and then get it right 60 seconds later, you've *learned* the card — but naive persistence would record the "Again" and schedule it for tomorrow with reduced ease factor. That's the wrong signal.

`MAX_REQUEUES = 2` gives each card two chances to come back within the session. If it fails all three encounters, *then* the failure is real and gets persisted. The insert at `current + 4` is deliberate spacing — close enough that you'll see it again soon, far enough that you've seen a few other cards first (spaced practice within the session).

**`requeueCount` is a `useRef`, not state:** state updates trigger renders. `requeueCount` needs to be mutated inside the grade handler but doesn't need to cause a re-render. A `useRef<Map>` survives renders without triggering them.

**Blacklisting mid-session:**

```tsx
// StudySession.tsx:183-197
const handleBlacklist = useCallback(async () => {
  await fetch("/api/blacklist", { method: "POST", body: JSON.stringify({ vocabId: cards[current].entry.id }) });
  const updatedCards = [...cards];
  updatedCards.splice(current, 1);
  advance(updatedCards, current < updatedCards.length ? current : 0);
}, [cards, current, advance]);
```

Splice at `current` — the next card slides into that index — advance stays at `current`. Same pattern as the re-queue splice. No special handling needed.

**Alternatives:**
- **Jitter / fuzz factor:** stock Anki adds ±5% randomness to intervals so cards don't all come due on the same day. Not implemented here — all cards at a given interval come due at the exact same time.
- **Keyboard shortcuts:** pressing `1/2/3/4` for grades, `Space` to reveal. Not implemented. A `useEffect` adding `keydown` listeners would be a straightforward addition.

---

### 3.9 `components/VocabCard.tsx` — the flashcard (client)

The card is **fully controlled**: `revealed` and `onReveal` are props, not local state.

```tsx
// components/VocabCard.tsx (approx :7-20)
interface VocabCardProps {
  entry: VocabCardEntry;
  revealed: boolean;
  onReveal: () => void;
}
```

Why? Because `StudySession` needs to reset `revealed = false` every time it advances to the next card (`StudySession.tsx:131`). If the card owned its own revealed state, the parent would have no way to reset it without remounting the component.

**Fallback display logic:**

```tsx
// (approx :14-16)
const display = entry.kanji ?? entry.kana;
const meanings = entry.allMeanings.length > 0 ? entry.allMeanings : [entry.meaning];
const primaryReading = entry.allReadings[0] ?? entry.kana;
```

- `entry.kanji` is null for pure-kana words (e.g., `"やっぱり"`). The `??` falls back to `kana`.
- `allMeanings` is empty until `jmdict_enrich.py` runs. The `?:` falls back to the raw JPDB meaning string.
- `allReadings[0]` is the primary kana reading from JMdict. Falls back to `kana` if enrichment hasn't happened.

**Furigana in sentences:** example sentences are stored as strings like `"[青春](せいしゅん)は短い"`. The card passes them through `<FuriganaText text={s.japaneseText} />` — the card itself doesn't parse anything, it delegates to the shared renderer.

---

### 3.10 `components/ReviewButtons.tsx` — grade grid (client)

```tsx
// components/ReviewButtons.tsx (approx :10-15)
const GRADE_STYLES: Record<Grade, string> = {
  1: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  2: "bg-orange-100 text-orange-700 ...",
  3: "bg-green-100 text-green-700 ...",
  4: "bg-blue-100 text-blue-700 ...",
};
```

Again: static string literals in the style map so Tailwind's scanner picks them up. The `Grade` type and `GRADE_LABELS` / `GRADE_DESCRIPTIONS` are all imported from `lib/srs.ts` — one source of truth for the scale.

---

### 3.11 `components/TutorDrawer.tsx` — streaming Ollama chat (client)

This is the most complex component. Worth reading in sections.

**The streaming loop:**

```tsx
// TutorDrawer.tsx (approx :75-106)
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      const token = data?.message?.content ?? "";
      if (token) {
        setMessages((prev) => {
          const msgs = [...prev];
          const last = msgs[msgs.length - 1];
          msgs[msgs.length - 1] = { ...last, content: last.content + token };
          return msgs;
        });
      }
    } catch { /* incomplete JSON line */ }
  }
}
```

**NDJSON format:** Ollama's `/api/chat` with `stream: true` sends one JSON object per newline. Each object looks like `{ "message": { "content": "some " }, "done": false }`. The loop splits on `\n`, pops the last (potentially incomplete) line back into `buffer`, and appends each token to the last message.

**Functional state update during streaming:** `setMessages((prev) => {...})` uses the callback form. This is required because the loop runs across multiple event loop turns — by the time the next `read()` resolves, React may have batched a render. The callback guarantees you're always appending to the *latest* state, not a stale closure over an old `messages` value.

**The furigana-as-Markdown-link hack:**

The Ollama system prompt (in `app/api/ollama/route.ts:22-25`) mandates this exact format for Japanese:
```
[Kanji](hiragana)
```

That is also valid Markdown link syntax. `react-markdown` processes the AI response and, when it hits `[聞](き)く`, renders an `<a href="き">聞</a>`. The `TutorDrawer` overrides the `a` renderer:

```tsx
// TutorDrawer.tsx (approx :312-331)
a: ({ href, children }) => {
  const isRealUrl = href && (href.startsWith("http://") || href.startsWith("https://"));
  if (!isRealUrl) {
    const reading = href ? decodeURIComponent(href) : "";
    return <ruby>{children}<rt className="text-[10px]">{reading}</rt></ruby>;
  }
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}
```

Non-URL hrefs (like `"き"`) are treated as furigana readings. The result: `<ruby>聞<rt>き</rt></ruby>く`. This is the same visual output as `FuriganaText`, but coming from a completely different rendering path — the prompt and the renderer are coupled.

**Why LaTeX support?** The tutor can explain grammar using mathematical notation for things like frequency tables or conjugation patterns. `content.split(/(\$\$...\$\$|\$.+?\$)/g)` splits the AI response into math and non-math segments, routing each to `<BlockMath>` or `<InlineMath>` from `react-katex`.

**Alternatives:**
- **No local Ollama — use the Claude API.** You'd replace the `/api/ollama/route.ts` with calls to `@anthropic-ai/sdk`. Better quality, costs money, requires internet access during study.
- **OpenAI API.** Same tradeoff.
- **No AI at all.** The app works fine without it — the drawer is a bolt-on. Removing it would shrink the bundle by eliminating `react-markdown`, `react-katex`, and `katex` (the three non-essential dependencies).

---

### 3.12 `app/vocab/page.tsx` + `VocabFilters.tsx` — server list, client filters

This is the cleanest example of the **hybrid server-client pattern** in the app.

**The server component** (`app/vocab/page.tsx`) reads `searchParams`, builds a dynamic Prisma `where` clause, runs the query, and renders the grid. Every filter change triggers a new server render — no client-side filtering, no duplicate data in JS memory.

**The client component** (`VocabFilters.tsx`) only handles the *inputs*:

```tsx
// VocabFilters.tsx (approx :23-36)
const [isPending, startTransition] = useTransition();

const handleChange = (key: string, value: string | null) => {
  startTransition(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // reset pagination on filter change
    router.push(`${pathname}?${next}`);
  });
};
```

**`useTransition()`:** wraps the `router.push` in a transition. While Next is re-fetching the RSC with the new search params, `isPending` is `true`. The component uses that to dim the filter bar (`opacity-60` during pending). This gives immediate visual feedback without a spinner, and the inputs remain interactive during the pending phase.

**Why not a `<form>` with `method="GET"`?** That would work (HTML forms can submit as GET, updating the URL). But `<form>` GET navigation always causes a full page reload in Next, losing the RSC streaming optimization. `router.push` inside `startTransition` gets the streaming behavior.

**Alternatives:**
- **Client-side filtering**: fetch all vocab once and filter in memory with JavaScript. Simpler for small datasets, doesn't scale, and means the full dataset is sent to the browser.
- **URL state with `nuqs`**: a library that makes `useSearchParams` + URL sync much more ergonomic, with Zod validation. Worth using if you add many more filter types.

---

### 3.13 `app/vocab/[id]/page.tsx` + `actions.ts` + `StartStudyButton.tsx`

**Server actions (`actions.ts`):**

```ts
// app/vocab/[id]/actions.ts:1-24
"use server";

import { prisma } from "@/lib/prisma";
import { blacklist, unblacklist } from "@/lib/services/blacklist";
import { revalidatePath } from "next/cache";

export async function addToStudyDeck(vocabId: number) {
  await prisma.userProgress.upsert({
    where: { vocabId },
    create: { vocabId },
    update: {},
  });
  revalidatePath(`/vocab/${vocabId}`);
}

export async function blacklistWord(vocabId: number) {
  await blacklist(vocabId);
  revalidatePath(`/vocab/${vocabId}`);
}

export async function unblacklistWord(vocabId: number) {
  await unblacklist(vocabId);
  revalidatePath(`/vocab/${vocabId}`);
}
```

**Why a separate file?** The `"use server"` directive can be either per-function or per-file. When placed at the top of a file, *every* export from that file becomes a server action. This file lives next to `page.tsx` in the same route segment — colocation makes the revalidation target obvious (`/vocab/${vocabId}` is the parent page).

**`revalidatePath` vs. `revalidateTag`:** `revalidatePath` invalidates Next's cache for a specific URL path. Since the detail page reads Prisma directly (no external fetch to cache), the cache being invalidated is Next's full-route cache. After the server action runs and `revalidatePath` fires, the next visit to that URL re-runs the page's Prisma queries.

**`upsert` for `addToStudyDeck`:** `update: {}` is an empty update — if a `UserProgress` row already exists (user already added this word), do nothing. This makes the action idempotent.

**The `StartStudyButton` client island:**

```tsx
// app/vocab/[id]/StartStudyButton.tsx:1-24
"use client";
import { useFormStatus } from "react-dom";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Add to study deck"}
    </button>
  );
}

export function StartStudyButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <SubmitBtn />
    </form>
  );
}
```

**Why is this a client component?** `useFormStatus()` is a client-only hook (it reads the nearest form's pending state from React's internal state). It can't run on the server. The trick: the parent `page.tsx` is a server component that passes the bound server action as a prop:

```tsx
// In app/vocab/[id]/page.tsx (approx :269)
<StartStudyButton action={addToStudyDeck.bind(null, entry.id)} />
```

`addToStudyDeck.bind(null, entry.id)` creates a new function with `vocabId` pre-baked. This bound function is safe to pass through the RSC/client boundary because Next serializes server actions specially. The result: minimal client JavaScript (just the form + button), with the actual DB mutation staying on the server.

**Why are `BlacklistButton` and `UnblacklistButton` NOT client components?** They don't need `useFormStatus` — they have no pending state UI. They're plain `<form>` elements with a server action as `action`. HTML forms work without JavaScript; clicking "Blacklist" submits the form, Next runs the action, `revalidatePath` fires, the page updates. Zero client JS.

**Alternatives:**
- Co-locate the button logic inside `page.tsx` using an inline server action. Works, but makes the file harder to read (mixing server and client concerns in one place).
- Use a route handler + `fetch` instead of a server action. More boilerplate (separate file, manual revalidation trigger), identical end result.

---

### 3.14 `app/analytics/page.tsx` — progress dashboard

```ts
// app/analytics/page.tsx:8-9
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
```

**Why not `d.toISOString().slice(0, 10)`?** `toISOString()` returns UTC. If you're in Tokyo (UTC+9) and it's 11pm, `toISOString()` returns yesterday's date. The streak counter and 7-day chart would appear to show no reviews today. `localDateKey` uses `getFullYear()`, `getMonth()`, `getDate()` — which read local time. This one function prevents a classic SRS bug.

**Streak logic:**

```ts
// app/analytics/page.tsx:66-77
const reviewedDays = new Set(logsWithDates.map((l) => localDateKey(l.reviewedAt)));
const startFrom = reviewedDays.has(todayKey) ? 0 : 1;
let streak = 0;
for (let i = startFrom; ; i++) {
  const d = new Date(now);
  d.setDate(d.getDate() - i);
  if (reviewedDays.has(localDateKey(d))) {
    streak++;
  } else {
    break;
  }
}
```

`startFrom = reviewedDays.has(todayKey) ? 0 : 1` handles the morning edge case: if you open analytics at 8am before your first review, today has no reviews. Without this check, the loop starts from today, finds no reviews, and breaks immediately — streak shows 0 even though you had a perfect streak yesterday. The fix: if today has no reviews, start counting from yesterday.

**The bar chart:**

```tsx
// app/analytics/page.tsx:138-163
<div className="flex items-end gap-2 h-28">
  {data.dailyReviews.map((day) => {
    const heightPct = day.total > 0 ? (day.total / maxDaily) * 100 : 0;
    return (
      <div key={day.date} className="flex-1">
        <div
          className={`w-full rounded-t ${isToday ? "bg-indigo-500" : "bg-indigo-300 dark:bg-indigo-700"}`}
          style={{ height: `${Math.max(heightPct, day.total > 0 ? 4 : 2)}%` }}
        />
      </div>
    );
  })}
</div>
```

No charting library. This is a pure CSS bar chart: a flex container with `items-end` (bars grow upward), each bar's height set as a `style` percentage. The `Math.max(heightPct, 4)` ensures bars for days with reviews are at least 4% tall (visible even for 1 review when another day had 100).

**Alternatives:**
- **Recharts, Chart.js, Nivo**: production charting libraries with animations, tooltips, accessibility. Worth the dependency if you want interactive charts. For a simple 7-day bar, the DIV approach is leaner.

---

## 4. API routes

### 4.1 `app/api/review/route.ts` — grade a card

```ts
// app/api/review/route.ts:26-46
const existing = await prisma.userProgress.findUnique({ where: { vocabId } });

const currentState = existing ?? {
  easeFactor: 2.5,
  interval: 0,
  repetitions: 0,
  nextReviewDate: new Date(),
};

const next = calculateNextReview(currentState, grade);

const [progress] = await Promise.all([
  prisma.userProgress.upsert({
    where: { vocabId },
    create:  { vocabId, ...next, lastReviewDate: new Date(), totalReviews: 1 },
    update:  { ...next, lastReviewDate: new Date(), totalReviews: { increment: 1 } },
  }),
  prisma.reviewLog.create({ data: { vocabId, grade } }),
]);
```

**SM-2 defaults on first grade:** `easeFactor: 2.5, interval: 0, repetitions: 0` are the textbook starting values for a new SM-2 card. `nextReviewDate: new Date()` means "due now," which is immediately overridden by `calculateNextReview`.

**`Promise.all` for progress + log:** both writes are independent — the review log doesn't depend on the progress upsert result. Running them concurrently saves one round-trip.

**Why `upsert` instead of `create` + `update`?** The `UserProgress` row may or may not exist (first time grading a card, it doesn't exist; subsequent times, it does). `upsert` handles both atomically: create if missing, update if present.

**Alternatives:**
- Run the progress update and log write sequentially. Simpler, slightly slower.
- Use a Prisma transaction. Not needed here since both writes are to different tables with no interdependency — a partial failure would be a bug to log, not a consistency problem to roll back.

---

### 4.2 `app/api/blacklist/route.ts` and `cross-novel/route.ts`

Two endpoints for one conceptual operation — intentionally split:

- **`POST /api/blacklist`**: blacklist *one* word. Hot path — called every time a user clicks "I already know this" during a session. Returns `{ ok: true }`.
- **`POST /api/blacklist/cross-novel`**: blacklist *all* overlapping words from other novels. One-shot bulk operation. Returns `{ count }`.

The return shapes differ, the performance profiles differ (one vs. potentially thousands of updates), and having them share an endpoint would require a discriminator field. Two endpoints is cleaner.

Both delegate to `lib/services/blacklist.ts` — the shared service. The route handlers are thin: parse, validate, call, respond.

---

### 4.3 `app/api/novels/reorder/route.ts` — non-transactional drag-reorder

```ts
// app/api/novels/reorder/route.ts (approx :13-17)
await Promise.all(
  items.map((item: { id: number; sortOrder: number }) =>
    prisma.novel.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
  )
);
```

Concurrent individual updates, not a transaction. **The risk:** if 3 of 5 updates succeed before a DB connection dies, the `sortOrder` values are half-updated and the grid appears out of order. For a personal app with typically ≤5 novels, this is acceptable. The user can drag to re-order again.

A transactional version would use `prisma.$transaction([...])`. For this use case, the added complexity isn't worth it.

---

### 4.4 `app/api/novels/[id]/route.ts` — manual cascade delete

```ts
// app/api/novels/[id]/route.ts:55-63
if (vocabIds.length > 0) {
  // Delete in FK dependency order
  await prisma.reviewLog.deleteMany({ where: { vocabId: { in: vocabIds } } });
  await prisma.userProgress.deleteMany({ where: { vocabId: { in: vocabIds } } });
  await prisma.exampleSentence.deleteMany({ where: { vocabId: { in: vocabIds } } });
  await prisma.vocabEntry.deleteMany({ where: { novelId } });
}
await prisma.novel.delete({ where: { id: novelId } });
```

**Why not just `prisma.novel.delete()`?** Because `schema.prisma` doesn't declare `onDelete: Cascade` on any of the foreign key relations. Without cascade, deleting a `Novel` with existing `VocabEntry` children would throw a foreign key constraint violation.

The handler works around this by walking the FK dependency graph manually: children that reference `vocabId` must be deleted before `VocabEntry`, and `VocabEntry` must be deleted before `Novel`.

**Why were cascades not added to the schema?** Probably because Prisma 7 with the driver adapter has some constraints around cascade migrations. Adding cascades is a valid improvement — it would simplify this handler to two lines.

**Alternatives:**
- Add `onDelete: Cascade` to the schema relations. Run a migration. Delete becomes `prisma.novel.delete()`. Cleaner.
- Use a raw SQL `CASCADE` delete. Same result.

---

### 4.5 `app/api/novels/[id]/cover/route.ts` — multipart file upload

The route reads `content-type: multipart/form-data`, validates extension and size, then:

```ts
// (approx :44-50)
await writeFile(
  join(process.cwd(), "public", "assets", filename),
  Buffer.from(await file.arrayBuffer())
);
await prisma.novel.update({
  where: { id: novelId },
  data: { coverImage: `assets/${filename}` },
});
```

Writes directly to `public/assets/` at runtime. The filename is `${slug}.{ext}` — using the slug means re-uploading a cover overwrites the old one, no orphan files.

**Limitation:** `public/` is served statically by Next. Files written there at runtime aren't tracked by the build. This works for development and self-hosted deployments. On Vercel or other serverless platforms, the filesystem is read-only in production — you'd need to swap this for S3, R2, or Supabase Storage.

**Alternatives:**
- **Object storage (S3, Cloudflare R2)**: correct for production multi-instance deployments. More setup.
- **Base64 in the database**: store the image as a blob column. Simple, but makes the DB large and slow for large covers.

---

### 4.6 `app/api/novels/scrape/route.ts` — SSE + Python child process

```ts
// app/api/novels/scrape/route.ts:45-53
const stream = new ReadableStream({
  start(controller) {
    const enc = new TextEncoder();
    const send = (obj: object) =>
      controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

    const child = spawn("python", [SCRAPE_SCRIPT, "--url", url, "--output", tmpOutput], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
```

**Why spawn a Python process?** The scraping logic is in `Scrape.py` — it handles JPDB's authentication, rate limiting, and HTML parsing. Rewriting that in TypeScript would be significant work with no benefit. Node's `child_process.spawn` runs the Python script and passes its output back.

**`PYTHONIOENCODING: "utf-8"`:** Without this, Python on Windows defaults to the system encoding (often cp932 for Japanese systems). Japanese characters in stdout would be mangled. The env override forces UTF-8.

**The temp file pattern:** the Python script writes scraped data to a temp file (`join(tmpdir(), `jpdb_${slug}_${Date.now()}.json`)`) because NDJSON progress events and the final JSON payload can't share stdout cleanly. Progress goes to stdout (read by Node line-by-line); the vocab JSON goes to a file (read after the process exits).

**Why SSE was the right choice here:**
- The scrape takes minutes (JPDB rate-limits to ~1.5 seconds per page).
- The client needs to see progress: "scraped 47 of 200 pages."
- Options: (1) Long-running POST with no feedback — bad UX. (2) Polling a job status endpoint — requires a jobs table. (3) WebSocket — bidirectional overkill. (4) SSE — one-way, standard HTTP, no extra state.
- SSE is the simplest thing that provides live progress for a long-running one-way operation.

```ts
// app/api/novels/scrape/route.ts:133-139
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  },
});
```

`Cache-Control: no-cache` prevents any proxy or CDN from buffering the stream. `Connection: keep-alive` is technically HTTP/1.1 — HTTP/2 doesn't use it, but it's harmless.

---

### 4.7 `app/api/ollama/route.ts` — the AI proxy

```ts
// app/api/ollama/route.ts:1-4
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL = "simmer-gemma";
```

Reads `OLLAMA_BASE_URL` from `.env`. Defaults to `localhost:11434` (Ollama's default port). The model name `simmer-gemma` is a local fine-tuned model — not a public model name, it's whatever you've pulled into your local Ollama instance.

**The prompt-as-frontend-contract:**

```ts
// app/api/ollama/route.ts:22-25
2. BRACKET NOTATION: Every single Japanese word — including single-kanji words — must use
   this exact format: [Kanji](hiragana). This applies EVERY time a kanji appears, no exceptions.
4. OKURIGANA: Keep verb endings outside the brackets. Example: [聞](き)く not [聞く](きく).
```

The system prompt mandates `[Kanji](reading)` notation. `TutorDrawer` interprets that as Markdown links and converts them to `<ruby>` elements. The prompt and the renderer are a coupled contract — if you change one, you must change the other. This is a tradeoff: tight coupling enables automatic furigana rendering without any post-processing step.

**Pass-through stream:**

```ts
// app/api/ollama/route.ts:57-60
return new Response(ollamaRes.body, {
  headers: { "Content-Type": "text/event-stream; charset=utf-8" },
});
```

The Ollama NDJSON stream is piped directly to the client with zero transformation. The route adds the Content-Type header so the client knows how to interpret it, then hands off the raw body.

**Alternatives:**
- **Direct client-to-Ollama connection**: expose `localhost:11434` to the browser. Impossible in production, security risk in development (CORS and network exposure).
- **Claude API (`@anthropic-ai/sdk`)**: `process.env.ANTHROPIC_API_KEY`, `client.messages.create(...)`. Better quality, costs money, no Ollama dependency.

---

## 5. Shared library

### 5.1 `lib/types.ts` — shared DTOs

```ts
// lib/types.ts:1-37
export interface Sentence { id, japaneseText, englishTrans }
export interface VocabCardEntry { id, kanji, kana, meaning, jlptLevel, partsOfSpeech, allReadings, allMeanings, sentences }
export interface VocabContext { word, reading, meaning, partsOfSpeech }
export type SRSStatus = "new" | "due" | "learning" | "learned";
export interface SessionCard { entry: VocabCardEntry; isNew: boolean }
```

**Why hand-authored DTOs instead of using Prisma's generated types?** Prisma generates types like `Prisma.VocabEntryGetPayload<{ include: { sentences: true } }>`. These types are exact but fragile — they change shape whenever the schema changes. `VocabCardEntry` is a stable interface that represents "what the app needs from a vocab entry" regardless of Prisma's internals. API responses, study session state, and component props all use this stable shape.

**`VocabContext` is narrower than `VocabCardEntry`:** the AI tutor only needs word, reading, meaning, and POS. Sending a full `VocabCardEntry` to the tutor would include sentence data that the tutor doesn't use and would bloat the prompt.

**`SessionCard.isNew`:** flags whether a card is being seen for the first time. Drives the "New" badge in `StudySession.tsx:277-281`. Could be inferred from `entry.progress === null`, but that field isn't in `VocabCardEntry` — the flag makes it explicit.

**Alternatives:**
- **Zod schemas**: define the shapes as Zod schemas, infer the TypeScript types from them, and validate API responses at runtime. Currently there's no runtime validation — if an API route returns the wrong shape, TypeScript won't catch it at runtime. Zod would.
- **Prisma-inferred types**: tighter coupling but no duplication.

---

### 5.2 `lib/jp.ts` — Japanese display helpers

```ts
// lib/jp.ts:5-11
export function isKanji(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0xf900 && code <= 0xfaff)    // CJK Compatibility
  );
}
```

**Why three Unicode ranges?** Not all kanji are in one block:
- `0x4e00–0x9FFF`: the main CJK Unified Ideographs block (20,902 characters, covers essentially all common Japanese kanji).
- `0x3400–0x4DBF`: CJK Extension A (6,582 rare characters, mostly academic).
- `0xF900–0xFAFF`: CJK Compatibility Ideographs (duplicate encodings for characters already in the main block, included for legacy compatibility).

**`codePointAt` vs `charCodeAt`:** JavaScript strings are UTF-16. Characters above U+FFFF (like some rare CJK Extension B characters) are represented as two UTF-16 code units (a "surrogate pair"). `charCodeAt` would give you half of the surrogate pair — a meaningless value. `codePointAt` combines the pair into the actual code point. The current ranges don't go above U+FFFF, but using `codePointAt` is the correct practice.

**`getSRSStatus` heuristic:**

```ts
// lib/jp.ts:60-68
export function getSRSStatus(progress, now): SRSStatus {
  if (!progress) return "new";
  if (progress.nextReviewDate <= now) return "due";
  if (progress.repetitions < 3) return "learning";
  return "learned";
}
```

`repetitions < 3` is the threshold for "learning" vs. "learned." This means a card you've reviewed twice (even if correctly both times) is still "learning." The threshold is arbitrary — Anki uses a different definition. The practical effect: the vocab browse page shows "learning" vs. "learned" labels based on this heuristic.

**Alternatives:**
- **Interval-based:** `interval >= 21` = "learned" (after you're reviewing once a month, you've probably learned it). More aligned with SRS theory.
- **Rep-count-based with a higher threshold:** `repetitions >= 5`. More conservative.

---

### 5.3 `lib/srs.ts` — the SM-2 algorithm

This is the mathematical heart of the app.

**The grade scale:**

| Grade | Label | SM-2 original | Interpretation |
|---|---|---|---|
| 1 | Again | 0 | Forgot completely |
| 2 | Hard | 3 | Remembered with difficulty |
| 3 | Good | 4 | Correct response |
| 4 | Easy | 5 | Perfect recall |

Original SM-2 used 0-5; Anki simplified to 4 buttons; this app follows Anki.

**The ease factor (`EF`):**

```ts
// lib/srs.ts:36-37
const easeAdjustment = grade === 2 ? -0.15 : grade === 4 ? 0.15 : 0;
newEaseFactor = Math.max(MIN_EASE, easeFactor + easeAdjustment);
```

EF starts at 2.5 (the SM-2 default, set in `schema.prisma:59`). It adjusts per review: Hard → -0.15, Good → ±0, Easy → +0.15. `MIN_EASE = 1.3` prevents the death spiral where difficult cards get reviewed so frequently they become unmanageable.

**The interval schedule:**

```ts
// lib/srs.ts:39-49
if (repetitions === 0) {
  newInterval = 1;
} else if (repetitions === 1) {
  newInterval = grade === 2 ? 1 : 6;
} else {
  newInterval = Math.round(interval * newEaseFactor);
  if (grade === 2) newInterval = Math.round(interval * 1.2);
  if (grade === 4) newInterval = Math.round(interval * newEaseFactor) + 1;
}
```

- First correct review: 1 day.
- Second correct review: 6 days (unless Hard, in which case 1 day again).
- Subsequent reviews: multiply the last interval by the ease factor. Hard caps growth to `*1.2`; Easy gets a +1 day bonus.

This matches the standard SM-2 progression. After the second review, the intervals grow roughly as: 6, 15, 38, 95... days (at EF=2.5).

**The Again branch:**

```ts
// lib/srs.ts:18-28
// The study session is responsible for re-queuing the card within the
// same session (up to 2 re-shows) before persisting this state to the DB.
if (grade === 1) {
  return {
    easeFactor: Math.max(MIN_EASE, easeFactor - 0.2),
    interval: 1,
    repetitions: 0,
    nextReviewDate: addDays(new Date(), 1),
  };
}
```

Again: EF drops by 0.2, interval resets to 1, repetitions reset to 0. The comment notes that the session layer (`StudySession.tsx`) re-queues the card within the session before persisting. So when this DB update *does* happen, it correctly records a reset.

**Why `addDays` uses `setDate`:**

```ts
// lib/srs.ts:59-63
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
```

`setDate()` handles month rollovers correctly — adding 31 days to January 30 gives March 2 (or March 1 in leap years), not an invalid date. Adding `days * 86400000` in milliseconds would work for most cases but breaks during DST transitions.

**Alternatives:**
- **FSRS (Free Spaced Repetition Scheduler)**: a modern ML-based algorithm Anki adopted in v23.10. Requires storing the full review history per card (which `ReviewLog` already provides). Dramatically better for irregular review patterns. The app already has everything needed to implement FSRS except the algorithm itself.
- **Leitner boxes**: simpler. Cards in box 1 are reviewed daily, box 2 every 2 days, box 3 every 4 days, etc. No ease factors, no intervals. Conceptually cleaner but less effective.
- **Half-life regression** (Duolingo's model): fits a memory decay curve to each card's review history. Requires ML infrastructure.

---

### 5.4 `lib/furigana.ts` — parser

Already covered in §3.5. Key points:
- The regex `RUBY_PATTERN` at line 10 is the only place the format is defined — change it once, everything updates.
- `stripFurigana` at line 36 (`replace(RUBY_PATTERN, "$1")`) keeps the kanji, drops the reading. Used for search and plain-text display.
- Limitation: nested brackets won't work (not a real risk in Japanese). No escape syntax.

---

### 5.5 `lib/prisma.ts` — the singleton PrismaClient

```ts
// lib/prisma.ts:1-19
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter, log: ... });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Two patterns in one file:**

**1. Driver adapter (Prisma 7):** In Prisma 7, you pass a driver adapter at construction time instead of putting the connection URL in `schema.prisma`. `PrismaPg` wraps `pg` (node-postgres). This decouples the ORM from the specific PostgreSQL client library — you could swap to Neon's adapter for edge deployments by changing two lines here.

**2. `globalThis` singleton:** Next.js in development uses Hot Module Replacement (HMR) — when you edit a file, it re-evaluates the module. Without caching on `globalThis`, every HMR cycle would create a new `PrismaClient`, each with its own connection pool. 10 rapid file saves = 10 connection pools = DB connection exhaustion. The singleton stores the client on `globalThis` (which survives HMR) and reuses it.

The `if (NODE_ENV !== "production")` guard: in production, serverless functions each have their own isolated process — `globalThis` is a separate object per instance. The guard prevents trying to "cache" something that has no meaning in that context.

**Alternatives:**
- **No singleton**: correct for Vercel serverless (short-lived functions don't have the HMR problem). Add `?connection_limit=1` to the connection URL to prevent connection pool exhaustion.
- **Prisma Accelerate / Data Proxy**: a connection pooler in front of your DB. Removes the need for the singleton pattern entirely.
- **Dependency injection**: construct `PrismaClient` in `app/layout.tsx` and pass it down via React context. Enables easier testing (inject a test client). More architecture overhead.

---

### 5.6 `lib/repositories/vocab.ts` — read queries

```ts
// lib/repositories/vocab.ts:18-26
const [totalVocab, learnedCount, dueCount, totalReviews, blacklistedCount] = await Promise.all([
  prisma.vocabEntry.count({ where: { novelId, blacklisted: false } }),
  prisma.userProgress.count({ where: { vocab: { novelId } } }),
  prisma.userProgress.count({ where: { nextReviewDate: { lte: now }, vocab: { novelId, blacklisted: false } } }),
  prisma.reviewLog.count({ where: { vocab: { novelId } } }),
  prisma.vocabEntry.count({ where: { novelId, blacklisted: true } }),
]);
```

Five counts run concurrently. Without `Promise.all`, this would take 5× as long.

**`learnedCount + blacklistedCount` at line 33:** blacklisted words are counted as "learned" for display. The reasoning: if you blacklisted a word, you already know it — from the app's perspective, it's been "learned" (excluded from future study). This is a business rule that lives in exactly one place.

**The `notIn: ids.length ? ids : [-1]` guard at line 102:**

```ts
// lib/repositories/vocab.ts:98-107
return prisma.vocabEntry.findMany({
  where: {
    novelId,
    blacklisted: false,
    id: { notIn: ids.length ? ids : [-1] },
  },
  orderBy: { occurrences: "desc" },
  take: limit,
  include: { sentences: true },
}) as unknown as VocabCardEntry[];
```

Prisma's behavior with `{ notIn: [] }` (empty array) is undefined/implementation-specific — some versions return no rows, some return all rows. Using `[-1]` (an ID that can never exist since IDs are auto-incrementing positive integers) makes the intent clear: "exclude nothing," expressed as "exclude an impossible ID."

**`orderBy: { occurrences: "desc" }`:** new words are introduced in frequency order — the words that appear most often in the novel come first. This is the key pedagogical decision: you'll learn the most impactful words first, rather than encountering rare vocabulary before common ones.

**Alternatives:**
- **Inline Prisma in each page**: skip the repository layer, put the queries directly in `page.tsx`. Works for simple apps. Breaks down when multiple pages need the same query with slightly different parameters.
- **Single SQL view**: `CREATE VIEW novel_stats AS SELECT novel_id, COUNT(*) FILTER (WHERE blacklisted) AS blacklisted, ... FROM vocab_entry GROUP BY novel_id`. One round trip. Needs to be managed separately from Prisma migrations.

---

### 5.7 `lib/services/blacklist.ts` — write logic with business rules

```ts
// lib/services/blacklist.ts:27-68
export async function blacklistCrossNovel(novelId: number): Promise<number> {
  // Step 1: find known vocab from OTHER novels
  const knownVocab = await prisma.vocabEntry.findMany({
    where: {
      novelId: { not: novelId },
      OR: [{ progress: { isNot: null } }, { blacklisted: true }],
    },
    select: { kana: true, kanji: true },
    distinct: ["kana", "kanji"],
  });

  // Step 2: find matching entries in THIS novel that aren't blacklisted yet
  const toBlacklist = await prisma.vocabEntry.findMany({
    where: {
      novelId,
      blacklisted: false,
      OR: [
        { kana: { in: knownKana } },
        ...(knownKanji.length > 0 ? [{ kanji: { in: knownKanji } }] : []),
      ],
    },
    select: { id: true },
  });

  // Step 3: bulk update
  await prisma.vocabEntry.updateMany({
    where: { id: { in: toBlacklist.map((v) => v.id) } },
    data: { blacklisted: true },
  });
}
```

**Two-step pattern instead of a subquery:** Prisma's `updateMany` doesn't support filtering through relations in its `where` clause (as of Prisma 7). You can't write `updateMany({ where: { novelId, kana: { in: otherNovel.kana } } })` directly. The workaround: fetch the IDs you want to update first, then update by ID. Two round trips instead of one.

**`distinct: ["kana", "kanji"]`:** fetches unique kana+kanji pairs from other novels. Without `distinct`, a word that appears in 3 other novels would appear 3 times in the result, making the `in` arrays needlessly large.

**Why `...(knownKanji.length > 0 ? [...] : [])` at line 54:** Prisma treats `{ kanji: { in: [] } }` unpredictably (edge case: empty `IN` clause in SQL). The conditional spread ensures we only add the kanji filter when there are actually kanji to match against.

**Repository vs. service distinction here:** `vocab.ts` has no branching — it just runs queries. `blacklist.ts` has the cross-novel overlap logic — it *decides* what to blacklist based on data from two queries. That's the meaningful split. Some teams flatten this into one "data" layer; others add a third "use-case" layer. The two-layer approach is pragmatic for this app's scale.

**Alternatives:**
- **Raw SQL with CTEs**: the entire operation in one query using `WITH known_vocab AS (...) UPDATE vocab_entry SET blacklisted = true WHERE kana IN (SELECT kana FROM known_vocab)`. One round trip. Harder to read and test in isolation.
- **Event-driven**: emit a `WordLearned` event, have a listener fan out blacklist updates. Correct for distributed systems, overkill for a local-first app.

---

## 6. Persistence layer

### 6.1 `prisma/schema.prisma` — the data model

```prisma
// prisma/schema.prisma:5-7
datasource db {
  provider = "postgresql"
}
```

**No `url` field.** This is the Prisma 7 quirk. When using a driver adapter (`PrismaPg`), the connection string is provided at `PrismaClient` construction time, not in the schema. Putting `url = env("DATABASE_URL")` here would cause a conflict — Prisma 7 errors if both a schema URL and an adapter are present. The schema is purely structural; runtime configuration lives in code.

**`UserProgress` is 1:1 with `VocabEntry`:**

```prisma
// prisma/schema.prisma:56-68
model UserProgress {
  easeFactor     Float    @default(2.5)
  interval       Int      @default(0)
  repetitions    Int      @default(0)
  nextReviewDate DateTime @default(now())
  totalReviews   Int      @default(0)

  vocabId        Int      @unique  // ← enforces 1:1
  vocab          VocabEntry @relation(...)
}
```

`vocabId @unique` means there can only ever be one `UserProgress` per `VocabEntry`. This encodes the "single user" assumption. Adding multi-user support later would require: make `vocabId` non-unique, add a `userId` column, add a composite unique index on `(vocabId, userId)`.

**Postgres arrays for enrichment data:**

```prisma
// prisma/schema.prisma:33-36
partsOfSpeech String[]
allReadings   String[]
allMeanings   String[]
tags          String[]
```

Postgres natively supports array columns. Prisma maps them to TypeScript `string[]` seamlessly. The alternative — a separate `VocabReading` table with FK back to `VocabEntry` — would require joins on every query. Arrays are simpler for read-mostly, immutable data like JMdict enrichment.

**`@default(now())` on `nextReviewDate`:**

```prisma
// prisma/schema.prisma:62
nextReviewDate DateTime @default(now())
```

When a new `UserProgress` row is created (first time grading a card), `nextReviewDate` defaults to "now" — the card is immediately due. This means the very first review of a card (when it's still "new") can trigger the SM-2 calculation correctly: `calculateNextReview({ nextReviewDate: now, ... }, grade)` gives the right first interval.

**`KanjiEntry` with `character` as primary key:**

```prisma
// prisma/schema.prisma:81
model KanjiEntry {
  character   String   @id
  ...
}
```

The kanji character itself is the primary key. This is unconventional (primary keys are usually integers) but correct here: the character string is globally unique (there's exactly one `@id` for each kanji in existence), stable, and directly lookupable. Lookups in `vocab/[id]/page.tsx` use `findMany({ where: { character: { in: [...] } } })` — natural and efficient.

**Alternatives:**
- **Cascade deletes in schema**: `vocab VocabEntry[] @relation(onDelete: Cascade)`. Would eliminate the manual cascade in the DELETE handler. A migration would add `ON DELETE CASCADE` to the FK constraint.
- **`jlptLevel` as an enum**: `enum JlptLevel { N1 N2 N3 N4 N5 }`. Prevents invalid values, but Prisma enum migrations are more complex and Python scripts would need to match the enum values exactly.

---

### 6.2 `prisma.config.ts` — CLI configuration for Prisma 7

```ts
// prisma.config.ts:1-14
import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL! },
});
```

**Why does this file exist?** The Prisma CLI (`prisma migrate dev`, `prisma studio`, `prisma db seed`) needs to know the connection URL. In Prisma 7, when you use a driver adapter, the schema has no `url` field — so the CLI has nowhere to get the URL from unless you provide `prisma.config.ts`.

**`dotenv.config()`:** Prisma 7 no longer auto-loads `.env` when a `prisma.config.ts` is present. The explicit call here loads the `.env` file so `process.env.DATABASE_URL` is available when the CLI runs.

---

### 6.3 Migrations — the evolution story

The migration files in `prisma/migrations/` tell the story of how the schema evolved:

1. **`20260413182204_init_with_jmdict_fields`** — initial schema: `VocabEntry`, `ExampleSentence`, `UserProgress`. Already includes JMdict array fields (`partsOfSpeech`, `allReadings`, etc.) — they were planned from the start, just not populated yet.

2. **`20260413184056_add_kanji_entry_all_meanings`** — adds `allMeanings` array and creates the `KanjiEntry` table. Shows that `allMeanings` was an afterthought once the JMdict structure was understood.

3. **`20260413192634_add_blacklist_reviewlog`** — adds `blacklisted` boolean to `VocabEntry` and creates `ReviewLog`. The analytics and blacklist features came after the basic SRS loop was working.

4. **`20260413193359_add_novels_modular`** — the most interesting migration. Adds the `Novel` table, seeds the first novel, and modifies `VocabEntry` to include `novelId`. The zero-downtime trick:

```sql
-- 20260413193359_add_novels_modular/migration.sql (key lines)
CREATE TABLE "Novel" (id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, ...);
INSERT INTO "Novel" (id, slug, title, ...) VALUES (1, 'bunny-girl-senpai-v1', ...);
SELECT setval('"Novel_id_seq"', 1);
ALTER TABLE "VocabEntry" ADD COLUMN "novelId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "VocabEntry" ADD CONSTRAINT "VocabEntry_novelId_fkey" FOREIGN KEY ...;
```

The INSERT of novel 1 + `setval` to 1 + ADD COLUMN with `DEFAULT 1` means: all existing vocab entries get `novelId = 1` (pointing to the new novel record), the FK constraint is satisfied, and future novels start auto-incrementing from 2. All in one migration, no backfill step needed.

---

### 6.4 `prisma/seed.ts` — initial data import

```ts
// prisma/seed.ts:25-36
const parts = entry.spelling.trim().split(' ');
let kanji = null;
let kana = '';

if (parts.length > 1) {
  // Has both kanji and kana (e.g., "青春 せいしゅん")
  kanji = parts[0];
  kana = parts[1];
} else {
  // Kana only (e.g., "やっぱり")
  kana = parts[0];
}
```

JPDB exports vocabulary as `"青春 せいしゅん"` for kanji words (space-separated) and `"やっぱり"` for kana-only words. The split-on-space heuristic covers both cases. Edge cases: words with spaces in them (virtually none in Japanese vocabulary) or words that are "kanji" but match a kana-only pattern (handled by the `parts.length > 1` check).

```ts
// prisma/seed.ts:49-52
const result = await prisma.vocabEntry.createMany({
  data: processedData,
  skipDuplicates: true,
});
```

`skipDuplicates: true`: if you run the seed twice, it won't crash on duplicate primary keys. However, there's no unique constraint on `(kanji, kana, novelId)` — "duplicate" here means conflicting with the auto-generated primary key, which can only happen if you somehow supply the same ID twice. A proper unique index would make the idempotency meaningful.

**Registered in `package.json:17-18`:**
```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

This tells `prisma migrate reset` and `prisma db seed` to run `tsx prisma/seed.ts` after resetting/seeding. `tsx` runs TypeScript files directly without a build step, equivalent to `ts-node` but faster.

**Alternatives:**
- **SQL `COPY FROM`**: for 17,000+ rows, `COPY` is an order of magnitude faster than `createMany`. The difference isn't noticeable for one-time seeding, but worth knowing.
- **`upsert` loop**: use a natural key `(novelId, kana)` for idempotent upserts. More correct but slower than bulk `createMany`.

---

## 7. Enrichment scripts (Python)

### 7.1 `scripts/jmdict_enrich.py` — JMdict + Tatoeba import

Run after seeding to fill in the JMdict fields on `VocabEntry`.

**Phase 1 — JMdict enrichment:**
Downloads the latest `jmdict-simplified` JSON (cached in `scripts/.cache/`), builds in-memory lookup indexes by kanji and kana, then walks every `VocabEntry` row and updates it with:
- `jmdictId`, `jlptLevel`, `partsOfSpeech[]`, `allReadings[]`, `allMeanings[]`, `tags[]`

**The best-match heuristic** (the interesting part):

```python
# jmdict_enrich.py (approx :194-229)
# 1. Try kanji index → filter by matching kana → prefer `common` entries
# 2. Fall back: try kana as a kanji key (handles entries where kana holds kanji forms)
# 3. Fall back: kana index → prefer entries where searched kana is the PRIMARY reading
#    (prevents "この" matching 九's secondary readings)
```

Step 3 is the subtle one. JMdict has entries where multiple kana readings are listed, but only the first is the "primary" reading. The word `この` appears as a reading of multiple entries. The heuristic prioritizes matches where the searched kana is the first (primary) reading, avoiding false matches.

**Stripping Prisma's `?schema=` suffix:**

```python
# jmdict_enrich.py (approx :52-53)
db_url = db_url.split("?")[0]
```

Prisma's `DATABASE_URL` may include `?schema=public`. `psycopg2` (pure Python PostgreSQL driver) doesn't understand that parameter and would fail to connect. The script strips everything after `?`.

**Phase 2 — Tatoeba example sentences (`--examples` flag):**
Downloads a separate `jmdict-examples-eng.json`, matches sentences to `VocabEntry` rows by kanji/kana, and inserts up to 3 sentences per entry into `ExampleSentence`. Sentences are stored in the bracket furigana notation (pre-processed by the jmdict-simplified project).

**Alternatives:**
- **Bulk UPDATE via `execute_values`**: Phase 1 updates one row at a time in a loop. `psycopg2.extras.execute_values` with `ON CONFLICT DO UPDATE` in a single batch would be much faster for 17k rows. The per-row loop is a known performance gap.
- **Prisma Python client**: use the official Prisma Python client instead of raw `psycopg2`. More idiomatic, but Prisma Python is less mature than the TypeScript client.

---

### 7.2 `scripts/kanjidic_import.py` — KANJIDIC2 import

Imports per-kanji data (readings, meanings, stroke count, JLPT level, frequency) into the `KanjiEntry` table.

**The JLPT integer mismatch:**

```python
# kanjidic_import.py (approx :109-112)
# KANJIDIC2 stores JLPT as: 1=N5, 2=N4, 3=N3, 4=N2 (N1 is not tagged)
_JLPT_INT_MAP = {1: "N5", 2: "N4", 3: "N3", 4: "N2"}
```

KANJIDIC2 numbers JLPT levels from 1 (easiest/most common) to 4 (hardest among tagged kanji), which is the *opposite* of the N-level naming (N5 is easiest, N1 is hardest). The `_JLPT_INT_MAP` lookup table handles this inversion. N1 kanji aren't tagged in KANJIDIC2 at all — they're just absent.

**Bulk upsert with `execute_values`:**

```python
# kanjidic_import.py (approx :156-173)
execute_values(
    cursor,
    """INSERT INTO "KanjiEntry" (character, onyomi, kunyomi, meanings, ...)
       VALUES %s
       ON CONFLICT (character) DO UPDATE SET onyomi=EXCLUDED.onyomi, ...""",
    records
)
```

All ~13,000 kanji inserted in one SQL statement. `ON CONFLICT DO UPDATE` makes it idempotent — re-running updates existing rows rather than failing. This is the same technique missing from `jmdict_enrich.py` Phase 1.

---

## 8. Gaps & honest flags

These are not bugs — they're tradeoffs made knowingly or oversights. Listed so you know where the sharp edges are.

**1. No keyboard shortcuts in the study session.**
`StudySession.tsx` accepts no `keydown` events. Grade 1/2/3/4 require mouse clicks. A quick win: add a `useEffect` with a `keydown` listener mapping `1-4` to grades and `Space` to reveal.

**2. Silent failure on novel reorder.**
`NovelGrid.tsx`'s drag-reorder fires a PATCH and optimistically updates the local list. If the PATCH fails, there's no rollback — the grid shows the reordered state but the DB disagrees. Fix: add a `.catch()` that reverts `novels` state to the pre-drag order.

**3. No `onDelete: Cascade` in the schema.**
Every novel delete requires a 5-step manual cascade in the DELETE handler. Adding cascade to `schema.prisma` and running a migration would simplify the handler to `prisma.novel.delete()`.

**4. No custom `error.tsx` or `not-found.tsx`.**
Pages call `notFound()` and fall through to Next's default 404 page (plain, unstyled). A `not-found.tsx` at `app/` level would provide a branded, navigable 404.

**5. `FuriganaText` marked `"use client"` unnecessarily.**
No hooks, no browser APIs. It could be a server component. Moving it would shave a few bytes from the client bundle — minor but clean.

**6. `NOT IN (bigList)` in `blacklistCrossNovel`.**
Finding the known-vocab IDs fetches all of them into memory, then uses `kana IN (bigList)`. As your known vocabulary grows into the thousands, this SQL anti-pattern degrades. An `EXISTS` subquery or a CTE join would scale better.

**7. `ReviewLog` has no index on `reviewedAt`.**
The analytics page queries `ReviewLog.findMany({ where: { reviewedAt: { gte: sevenDaysAgo } } })` and also `findMany` (no filter) for streak calculation. With thousands of reviews, adding `@@index([reviewedAt])` to the schema would make these queries faster.

**8. `sessionStorage.setItem` in a hot effect.**
`StudySession.tsx:84` serializes the full `cards` array on every state change. For small sessions (20 cards), this is imperceptible. For large sessions (200 cards with many example sentences), this could be a noticeable micro-stutter. Throttling with `useRef` + `setTimeout` would help.

**9. Cover image storage in `public/`.**
Works for development and self-hosted deployments. On serverless platforms (Vercel, Railway with ephemeral file systems), files written to `public/` don't persist. Object storage (S3, R2) would be the correct production path.

**10. The Ollama model is hard-coded.**
`MODEL = "simmer-gemma"` in `app/api/ollama/route.ts:4`. A `.env` variable (`OLLAMA_MODEL`) would let you switch models without a code change.

---

## 9. File-map cheat sheet

| Path | Kind | Lines | Role |
|---|---|---|---|
| `app/layout.tsx` | RSC | 38 | Root HTML shell, fonts, SW mount |
| `app/globals.css` | CSS | 83 | Tailwind v4 theme, ruby, slider |
| `app/manifest.ts` | Config | 41 | PWA manifest (file-based metadata) |
| `app/page.tsx` | RSC | 47 | Landing page, novel grid data |
| `app/novel/[id]/page.tsx` | RSC | 143 | Novel dashboard + Suspense stream |
| `app/novel/[id]/loading.tsx` | RSC | ~8 | Skeleton while route resolves |
| `app/novels/new/page.tsx` | RSC | 12 | Suspense wrapper for scrape form |
| `app/novels/new/NewNovelForm.tsx` | CC | ~304 | SSE scrape form, state machine |
| `app/study/page.tsx` | RSC | 16 | Suspense wrapper for useSearchParams |
| `app/study/StudySession.tsx` | CC | 333 | Full review session loop |
| `app/vocab/page.tsx` | RSC | ~251 | Vocab list with server-side filters |
| `app/vocab/VocabFilters.tsx` | CC | ~94 | Filter inputs → URL → RSC re-render |
| `app/vocab/[id]/page.tsx` | RSC | ~422 | Vocab detail, kanji, sentences |
| `app/vocab/[id]/actions.ts` | Server action | 25 | Add/blacklist/unblacklist |
| `app/vocab/[id]/StartStudyButton.tsx` | CC | 24 | useFormStatus pending state |
| `app/analytics/page.tsx` | RSC | 168 | 7-day chart, streak, stats |
| `app/api/review/route.ts` | Route handler | 47 | GET queue, POST grade |
| `app/api/blacklist/route.ts` | Route handler | ~20 | Blacklist one word |
| `app/api/blacklist/cross-novel/route.ts` | Route handler | ~20 | Bulk cross-novel blacklist |
| `app/api/novels/reorder/route.ts` | Route handler | ~20 | Update sort order |
| `app/api/novels/[id]/route.ts` | Route handler | 66 | PATCH title, DELETE with cascade |
| `app/api/novels/[id]/cover/route.ts` | Route handler | ~60 | Multipart cover upload |
| `app/api/novels/scrape/route.ts` | Route handler | 140 | SSE + Python child process |
| `app/api/vocab/route.ts` | Route handler | ~34 | Generic vocab list (possibly unused) |
| `app/api/vocab/[id]/context/route.ts` | Route handler | ~36 | Tutor context payload |
| `app/api/ollama/route.ts` | Route handler | 61 | Proxy NDJSON stream from Ollama |
| `components/StatCard.tsx` | RSC | 25 | Metric tile |
| `components/SessionStarter.tsx` | CC | 75 | Slider + start session |
| `components/CrossNovelSetup.tsx` | CC | 105 | Two-mode blacklist banner/button |
| `components/VocabCard.tsx` | CC | ~133 | Flashcard (controlled) |
| `components/ReviewButtons.tsx` | CC | ~35 | 4-button grade grid |
| `components/FuriganaText.tsx` | CC* | 27 | `[漢字](kana)` → `<ruby>` |
| `components/TutorDrawer.tsx` | CC | ~392 | Streaming Ollama chat, KaTeX, furigana |
| `components/NovelGrid.tsx` | CC | ~342 | Drag-reorder, rename, delete |
| `components/ServiceWorkerRegistrar.tsx` | CC | 15 | Registers `/sw.js` once on mount |
| `public/sw.js` | Service Worker | 38 | Network-first offline cache |
| `lib/types.ts` | Pure TS | 37 | Shared DTOs |
| `lib/jp.ts` | Pure TS | 75 | Japanese helpers, JLPT colors, SRS status |
| `lib/srs.ts` | Pure TS | 77 | SM-2 algorithm |
| `lib/furigana.ts` | Pure TS | 38 | Bracket notation parser |
| `lib/prisma.ts` | Node | 19 | PrismaClient singleton (driver adapter) |
| `lib/repositories/vocab.ts` | Node | 129 | Read-only DB queries |
| `lib/services/blacklist.ts` | Node | 68 | Blacklist write logic + business rules |
| `prisma/schema.prisma` | Prisma | 90 | Data model |
| `prisma.config.ts` | Config | 14 | Prisma 7 CLI config (no URL in schema) |
| `prisma/seed.ts` | Script | 64 | Bulk-insert JPDB vocab JSON |
| `prisma/set_cover.ts` | Script | ~29 | Admin one-off: set novel cover path |
| `scripts/jmdict_enrich.py` | Python | ~330 | JMdict + Tatoeba enrichment |
| `scripts/kanjidic_import.py` | Python | ~180 | KANJIDIC2 kanji import |
| `package.json` | Config | 45 | Dependencies, npm scripts, prisma.seed |
| `tsconfig.json` | Config | ~28 | TypeScript: `@/*` alias, strict mode |
| `next.config.ts` | Config | 10 | Minimal Next config (no remote images) |
| `postcss.config.mjs` | Config | 7 | Tailwind v4 PostCSS plugin |

*CC = `"use client"` (client component). RSC = Server Component (default). `FuriganaText` is marked CC but has no hooks — could be RSC.

---

*Document generated 2026-04-21 from source code at commit `f260d74`. File:line references are valid for that commit.*
