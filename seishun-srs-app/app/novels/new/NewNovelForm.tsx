"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ScrapeStatus = "idle" | "scraping" | "done" | "error";
// Tracks which sub-phase the scraping screen is in
type ScrapePhase = "collecting" | "importing";

interface ProgressEvent {
  type: "progress" | "done" | "complete" | "error";
  scraped?: number;
  total?: number;
  offset?: number;
  count?: number;
  novelId?: number;
  message?: string;
}

export default function NewNovelForm() {
  const router = useRouter();

  const [url, setUrl]             = useState("");
  const [title, setTitle]         = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [autoBlacklist, setAutoBlacklist] = useState(true);
  const [status, setStatus]       = useState<ScrapeStatus>("idle");
  const [phase, setPhase]         = useState<ScrapePhase>("collecting");
  const [scraped, setScraped]     = useState(0);
  const [total, setTotal]         = useState<number | null>(null);
  const [errorMsg, setErrorMsg]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  /** Derive a URL-safe slug from the novel title */
  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 60);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !title) return;

    const slug = slugify(title);

    try {
      // Fire the request first — if the route returns a non-2xx (e.g. 409 slug conflict)
      // we show the error on the form without ever entering the loading state.
      const res = await fetch("/api/novels/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, title, slug, autoBlacklist }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to start scrape." }));
        setErrorMsg(err.error ?? "Unknown error.");
        setStatus("error");
        return;
      }

      if (!res.body) throw new Error("No response body from server.");

      // Response is a streaming SSE — now it's safe to enter the loading state
      setStatus("scraping");
      setPhase("collecting");
      setScraped(0);
      setTotal(null);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

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
            const event: ProgressEvent = JSON.parse(dataLine);

            if (event.type === "progress") {
              setScraped(event.scraped ?? 0);
            } else if (event.type === "done") {
              // Scraping finished — DB import is starting
              setTotal(event.count ?? null);
              setPhase("importing");
            } else if (event.type === "complete" && event.novelId) {
              if (coverFile) {
                const form = new FormData();
                form.append("cover", coverFile);
                await fetch(`/api/novels/${event.novelId}/cover`, { method: "POST", body: form });
              }
              setStatus("done");
              setTimeout(() => router.push(`/novel/${event.novelId}`), 1200);
              return;
            } else if (event.type === "error") {
              setErrorMsg(event.message ?? "Unknown error");
              setStatus("error");
              return;
            }
          } catch {
            // Incomplete or non-JSON line — ignore
          }
        }
      }
    } catch (err) {
      setErrorMsg(String(err));
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-12 gap-8">
      <div className="w-full max-w-lg">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors mb-6 inline-block">
          ← All novels
        </Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">Add novel</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          Paste a JPDB vocabulary list URL to scrape and import a new novel.
        </p>
      </div>

      {status === "idle" || status === "error" ? (
        <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-5">
          {/* JPDB URL */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              JPDB vocabulary URL
            </label>
            <input
              type="url"
              required
              placeholder="https://jpdb.io/novel/…/vocabulary-list"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Novel title */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Novel title
            </label>
            <input
              type="text"
              required
              placeholder="青春ブタ野郎はバニーガール先輩の夢を見ない"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Cover image <span className="text-zinc-400 font-normal">(optional, max 2 MB)</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-600 px-4 py-5 flex flex-col items-center gap-1 cursor-pointer transition-colors"
            >
              {coverFile ? (
                <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{coverFile.name}</p>
              ) : (
                <>
                  <p className="text-sm text-zinc-500">Click to browse local files</p>
                  <p className="text-xs text-zinc-400">webp · jpg · png</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".webp,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Auto-blacklist toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={autoBlacklist}
                onChange={(e) => setAutoBlacklist(e.target.checked)}
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${autoBlacklist ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoBlacklist ? "translate-x-4" : ""}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Auto-blacklist words I already know
              </p>
              <p className="text-xs text-zinc-400">
                Words studied in other novels won&apos;t appear in this novel&apos;s review queue
              </p>
            </div>
          </label>

          {status === "error" && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-3">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base transition-colors"
          >
            Start scraping
          </button>
        </form>

      ) : status === "scraping" ? (
        <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 text-center space-y-6">
          {phase === "collecting" ? (
            <>
              <SpinnerRing />
              <div>
                <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-1">
                  Collecting vocabulary…
                </h2>
                <p className="text-zinc-400 text-sm">Scraping pages from JPDB</p>
              </div>
              <div className="py-2">
                <p className="text-5xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {scraped.toLocaleString()}
                </p>
                <p className="text-sm text-zinc-400 mt-1">words found so far</p>
              </div>
              <p className="text-xs text-zinc-400">
                JPDB requires a 1.5 s delay between pages — this may take a couple of minutes.
              </p>
            </>
          ) : (
            <>
              <SpinnerRing />
              <div>
                <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-1">
                  Importing into database…
                </h2>
                <p className="text-zinc-400 text-sm">
                  Writing {total?.toLocaleString() ?? "…"} words — almost done
                </p>
              </div>
              <p className="text-xs text-zinc-400">
                Running cross-novel checks and enrichment lookups.
              </p>
            </>
          )}
        </div>

      ) : (
        /* done */
        <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 text-center space-y-4">
          <p className="text-4xl">✓</p>
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Import complete!</h2>
          <p className="text-zinc-500 text-sm">
            {total?.toLocaleString() ?? "All"} words imported. Redirecting to the novel dashboard…
          </p>
        </div>
      )}
    </div>
  );
}

function SpinnerRing() {
  return (
    <div className="flex justify-center">
      <svg
        className="animate-spin text-indigo-500"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
      >
        <circle
          cx="24" cy="24" r="20"
          stroke="currentColor"
          strokeWidth="4"
          strokeOpacity="0.2"
        />
        <path
          d="M44 24a20 20 0 0 0-20-20"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
