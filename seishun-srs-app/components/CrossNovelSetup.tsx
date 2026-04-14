"use client";

import { useState } from "react";

interface CrossNovelSetupProps {
  novelId: number;
  /** When true, renders as a compact button instead of a prominent banner */
  showAsButton?: boolean;
}

export default function CrossNovelSetup({ novelId, showAsButton = false }: CrossNovelSetupProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [blacklistedCount, setBlacklistedCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed && !showAsButton) return null;

  const handleBlacklist = async () => {
    setStatus("loading");
    const res = await fetch("/api/blacklist/cross-novel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novelId }),
    });
    const data = await res.json();
    setBlacklistedCount(data.count ?? 0);
    setStatus("done");
  };

  // ── Compact button mode (always visible in advanced section) ──────────────
  if (showAsButton) {
    return (
      <div className="w-full max-w-lg">
        <details className="group">
          <summary className="text-xs text-zinc-400 hover:text-zinc-600 cursor-pointer select-none transition-colors">
            Advanced options
          </summary>
          <div className="mt-3 p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">
              Re-check for words you already know from other novels and blacklist overlapping entries in this one.
            </p>
            {status === "done" ? (
              <p className="text-sm text-indigo-600 dark:text-indigo-400">
                Done — {blacklistedCount} word{blacklistedCount !== 1 ? "s" : ""} newly blacklisted.
              </p>
            ) : (
              <button
                onClick={handleBlacklist}
                disabled={status === "loading"}
                className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-600 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-60"
              >
                {status === "loading" ? "Checking…" : "Blacklist words I already know"}
              </button>
            )}
          </div>
        </details>
      </div>
    );
  }

  // ── Banner mode (shown on first visit when overlap exists) ────────────────
  return (
    <div className="w-full max-w-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5">
      <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">
        New novel — import known words?
      </h3>

      {status === "done" ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            {blacklistedCount} word{blacklistedCount !== 1 ? "s" : ""} blacklisted — they won&apos;t appear in reviews.
          </p>
          <button
            onClick={() => setDismissed(true)}
            className="text-sm text-indigo-500 hover:text-indigo-700 ml-4"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4">
            You have vocabulary from other novels that overlaps with this one. Would you like to
            automatically blacklist words you already know so they don&apos;t show up in reviews?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleBlacklist}
              disabled={status === "loading"}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {status === "loading" ? "Blacklisting…" : "Yes, skip words I know"}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-4 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
            >
              No, show everything
            </button>
          </div>
        </>
      )}
    </div>
  );
}
