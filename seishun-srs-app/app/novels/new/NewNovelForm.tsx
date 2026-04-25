"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Status = "idle" | "importing" | "done" | "error";

export default function NewNovelForm() {
  const router = useRouter();

  const [title, setTitle]             = useState("");
  const [vocabFile, setVocabFile]     = useState<File | null>(null);
  const [coverFile, setCoverFile]     = useState<File | null>(null);
  const [autoBlacklist, setAutoBlacklist] = useState(true);
  const [status, setStatus]           = useState<Status>("idle");
  const [count, setCount]             = useState<number | null>(null);
  const [errorMsg, setErrorMsg]       = useState("");
  const vocabRef  = useRef<HTMLInputElement>(null);
  const coverRef  = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !vocabFile) return;

    setStatus("importing");
    setErrorMsg("");

    try {
      const form = new FormData();
      form.append("title", title);
      form.append("vocab", vocabFile);
      form.append("autoBlacklist", String(autoBlacklist));

      const res = await fetch("/api/novels/import", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Import failed.");
        setStatus("error");
        return;
      }

      setCount(data.count ?? null);

      if (coverFile) {
        const coverForm = new FormData();
        coverForm.append("cover", coverFile);
        await fetch(`/api/novels/${data.novelId}/cover`, { method: "POST", body: coverForm });
      }

      setStatus("done");
      setTimeout(() => router.push(`/novel/${data.novelId}`), 1200);
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
          Upload a vocab JSON file to import a new novel.
        </p>
      </div>

      {status === "idle" || status === "error" ? (
        <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-5">

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

          {/* Vocab JSON */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Vocabulary JSON <span className="text-zinc-400 font-normal">(required)</span>
            </label>
            <div
              onClick={() => vocabRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-600 px-4 py-5 flex flex-col items-center gap-1 cursor-pointer transition-colors"
            >
              {vocabFile ? (
                <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">{vocabFile.name}</p>
              ) : (
                <>
                  <p className="text-sm text-zinc-500">Click to browse</p>
                  <p className="text-xs text-zinc-400">JSON array of vocab entries</p>
                </>
              )}
            </div>
            <input
              ref={vocabRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => setVocabFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1.5 text-xs text-zinc-400">
              Format: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">[{"{ \"spelling\": \"kanji kana\", \"meaning\": \"…\", \"occurrences\": 0 }"}]</code>
            </p>
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Cover image <span className="text-zinc-400 font-normal">(optional, max 2 MB)</span>
            </label>
            <div
              onClick={() => coverRef.current?.click()}
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
              ref={coverRef}
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
            disabled={!title || !vocabFile}
            className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-base transition-colors"
          >
            Import novel
          </button>
        </form>

      ) : status === "importing" ? (
        <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 text-center space-y-6">
          <div className="flex justify-center">
            <svg className="animate-spin text-indigo-500" width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" strokeOpacity="0.2" />
              <path d="M44 24a20 20 0 0 0-20-20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-1">
              Importing…
            </h2>
            <p className="text-zinc-400 text-sm">Writing vocabulary to database</p>
          </div>
        </div>

      ) : (
        <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 text-center space-y-4">
          <p className="text-4xl">✓</p>
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">Import complete!</h2>
          <p className="text-zinc-500 text-sm">
            {count !== null ? `${count.toLocaleString()} words` : "All words"} imported. Redirecting…
          </p>
        </div>
      )}
    </div>
  );
}
