import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Suspense } from "react";
import VocabFilters from "./VocabFilters";
import { JLPT_COLORS, getSRSStatus, SRS_BADGE, formatPOS } from "@/lib/jp";
import type { SRSStatus } from "@/lib/types";

const PAGE_SIZE = 60;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    jlpt?: string;
    status?: string;
    page?: string;
    novelId?: string;
  }>;
}

export default async function VocabPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const jlpt = sp.jlpt ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const novelId = sp.novelId ? parseInt(sp.novelId) : undefined;
  const offset = (page - 1) * PAGE_SIZE;

  // Build where clause
  const now = new Date();
  const where: Record<string, unknown> = {};
  if (novelId) where.novelId = novelId;

  if (q) {
    where.OR = [
      { kanji: { contains: q } },
      { kana: { contains: q } },
      { meaning: { contains: q, mode: "insensitive" } },
    ];
  }
  if (jlpt) where.jlptLevel = jlpt;

  // Status filter — requires subquery via Prisma nested where
  if (status === "new") {
    where.progress = null;
  } else if (status === "learning") {
    where.progress = { isNot: null };
  } else if (status === "due") {
    where.progress = { nextReviewDate: { lte: now } };
  }

  // Only offer JLPT filter buttons for levels that actually have data
  const jlptLevelRows = await prisma.vocabEntry.groupBy({
    by: ["jlptLevel"],
    where: { ...(novelId ? { novelId } : {}), jlptLevel: { not: null } },
  });
  const availableJlpt = jlptLevelRows
    .map((r) => r.jlptLevel as string)
    .sort((a, b) => {
      const order = ["N5", "N4", "N3", "N2", "N1"];
      return order.indexOf(a) - order.indexOf(b);
    });

  const [entries, total] = await Promise.all([
    prisma.vocabEntry.findMany({
      where,
      orderBy: [{ occurrences: "desc" }],
      take: PAGE_SIZE,
      skip: offset,
      select: {
        id: true,
        kanji: true,
        kana: true,
        meaning: true,
        occurrences: true,
        jlptLevel: true,
        partsOfSpeech: true,
        progress: {
          select: { nextReviewDate: true, interval: true, repetitions: true },
        },
      },
    }),
    prisma.vocabEntry.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen px-4 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={novelId ? `/novel/${novelId}` : "/"}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          ← {novelId ? "Dashboard" : "Novels"}
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Vocabulary</h1>
      </div>

      {/* Filters — needs Suspense for useSearchParams */}
      <div className="mb-6">
        <Suspense fallback={<div className="h-20 animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-xl" />}>
          <VocabFilters total={total} availableJlpt={availableJlpt} />
        </Suspense>
      </div>

      {/* Grid */}
      {entries.length === 0 ? (
        <p className="text-center text-zinc-400 py-16">No words match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {entries.map((entry) => {
            const srsStatus = getSRSStatus(entry.progress, now);
            return (
              <Link
                key={entry.id}
                href={`/vocab/${entry.id}`}
                className="group flex flex-col gap-1.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 hover:border-indigo-400 hover:shadow-md transition-all"
              >
                {/* Word + badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
                      {entry.kanji ?? entry.kana}
                    </span>
                    {entry.kanji && (
                      <span className="ml-2 text-sm text-zinc-400">{entry.kana}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {entry.jlptLevel && (
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                          JLPT_COLORS[entry.jlptLevel] ?? ""
                        }`}
                      >
                        {entry.jlptLevel}
                      </span>
                    )}
                    <SRSBadge status={srsStatus} />
                  </div>
                </div>

                {/* Meaning */}
                <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug">
                  {entry.meaning.split(";")[0]}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-2 mt-auto pt-1">
                  {entry.partsOfSpeech.length > 0 && (
                    <span className="text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      {formatPOS(entry.partsOfSpeech[0])}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-zinc-300 dark:text-zinc-600">
                    ×{entry.occurrences}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Suspense>
          <Pagination page={page} totalPages={totalPages} sp={sp} />
        </Suspense>
      )}
    </div>
  );
}

function SRSBadge({ status }: { status: SRSStatus }) {
  const { label, cls } = SRS_BADGE[status];
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${cls}`}>
      {label}
    </span>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  sp,
}: {
  page: number;
  totalPages: number;
  sp: Record<string, string | undefined>;
}) {
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.jlpt) params.set("jlpt", sp.jlpt);
    if (sp.status) params.set("status", sp.status);
    if (sp.novelId) params.set("novelId", sp.novelId);
    params.set("page", String(p));
    return `/vocab?${params.toString()}`;
  };

  // Show at most 7 page buttons
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 pb-8">
      {page > 1 && (
        <Link href={makeHref(page - 1)} className="pager-btn">
          ←
        </Link>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-zinc-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={makeHref(p as number)}
            className={`pager-btn ${p === page ? "pager-btn-active" : ""}`}
          >
            {p}
          </Link>
        )
      )}
      {page < totalPages && (
        <Link href={makeHref(page + 1)} className="pager-btn">
          →
        </Link>
      )}
    </div>
  );
}
