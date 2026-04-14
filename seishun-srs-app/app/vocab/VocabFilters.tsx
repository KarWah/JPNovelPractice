"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";

const JLPT_OPTIONS = ["", "N1", "N2", "N3", "N4", "N5"] as const;
const STATUS_OPTIONS = [
  { value: "", label: "All words" },
  { value: "new", label: "Not started" },
  { value: "learning", label: "Learning" },
  { value: "due", label: "Due for review" },
] as const;

export default function VocabFilters({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page"); // reset to page 1 on filter change
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [params, pathname, router]
  );

  const q = params.get("q") ?? "";
  const jlpt = params.get("jlpt") ?? "";
  const status = params.get("status") ?? "";

  return (
    <div className={`flex flex-col gap-3 transition-opacity ${isPending ? "opacity-60" : ""}`}>
      {/* Search */}
      <input
        type="search"
        placeholder="Search kanji, kana, or meaning…"
        defaultValue={q}
        onChange={(e) => update("q", e.target.value)}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* JLPT filter */}
        <div className="flex gap-1">
          {JLPT_OPTIONS.map((lvl) => (
            <button
              key={lvl}
              onClick={() => update("jlpt", lvl)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                jlpt === lvl
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {lvl || "All"}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => update("status", e.target.value)}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <span className="ml-auto text-xs text-zinc-400">{total.toLocaleString()} words</span>
      </div>
    </div>
  );
}
