import { prisma } from "@/lib/prisma";
import type { VocabCardEntry } from "@/lib/types";

// ── Novel stats ───────────────────────────────────────────────────────────────

export interface NovelStats {
  totalVocab: number;
  learnedCount: number;
  dueCount: number;
  newAvailableCount: number;
  totalReviews: number;
  maxSessionCards: number;
}

export async function getNovelStats(novelId: number): Promise<NovelStats> {
  const now = new Date();

  const [totalVocab, learnedCount, dueCount, totalReviews, blacklistedCount] = await Promise.all([
    prisma.vocabEntry.count({ where: { novelId, blacklisted: false } }),
    prisma.userProgress.count({ where: { vocab: { novelId } } }),
    prisma.userProgress.count({
      where: { nextReviewDate: { lte: now }, vocab: { novelId, blacklisted: false } },
    }),
    prisma.reviewLog.count({ where: { vocab: { novelId } } }),
    prisma.vocabEntry.count({ where: { novelId, blacklisted: true } }),
  ]);

  const learnedIds = await getLearnedVocabIds(novelId);
  const newAvailableCount = await prisma.vocabEntry.count({
    where: {
      novelId,
      blacklisted: false,
      id: { notIn: learnedIds.length ? learnedIds : [-1] },
    },
  });

  return {
    totalVocab,
    learnedCount: learnedCount + blacklistedCount,
    dueCount,
    newAvailableCount,
    totalReviews,
    maxSessionCards: dueCount + newAvailableCount,
  };
}

// ── Landing page per-novel summary (lighter query) ────────────────────────────

export interface NovelSummary {
  novelId: number;
  learned: number;
  due: number;
}

export async function getNovelSummary(novelId: number): Promise<NovelSummary> {
  const now = new Date();
  const [learned, due, blacklisted] = await Promise.all([
    prisma.userProgress.count({ where: { vocab: { novelId } } }),
    prisma.userProgress.count({
      where: { vocab: { novelId }, nextReviewDate: { lte: now } },
    }),
    prisma.vocabEntry.count({ where: { novelId, blacklisted: true } }),
  ]);
  return { novelId, learned: learned + blacklisted, due };
}

// ── Review queue ──────────────────────────────────────────────────────────────

export interface ReviewQueue {
  due: { vocab: VocabCardEntry }[];
  newWords: VocabCardEntry[];
}

export async function getReviewQueue(novelId: number, count: number): Promise<ReviewQueue> {
  const now = new Date();

  const due = await prisma.userProgress.findMany({
    where: {
      nextReviewDate: { lte: now },
      vocab: { novelId, blacklisted: false },
    },
    orderBy: { nextReviewDate: "asc" },
    take: count,
    include: { vocab: { include: { sentences: true } } },
  }) as { vocab: VocabCardEntry }[];

  const newWordSlots = Math.max(0, count - due.length);
  const newWords =
    newWordSlots > 0
      ? await getNewWords(novelId, newWordSlots)
      : [];

  return { due, newWords };
}

// ── New words (not yet in UserProgress) ───────────────────────────────────────

export async function getNewWords(
  novelId: number,
  limit: number
): Promise<VocabCardEntry[]> {
  const learnedIds = await getLearnedVocabIds(novelId);
  return prisma.vocabEntry.findMany({
    where: {
      novelId,
      blacklisted: false,
      id: { notIn: learnedIds.length ? learnedIds : [-1] },
    },
    orderBy: { occurrences: "desc" },
    take: limit,
    include: { sentences: true },
  }) as unknown as VocabCardEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the set of vocabIds that already have a UserProgress row (optionally filtered to one novel) */
export async function getLearnedVocabIds(novelId?: number): Promise<number[]> {
  const rows = await prisma.userProgress.findMany({
    select: { vocabId: true },
    ...(novelId ? { where: { vocab: { novelId } } } : {}),
  });
  return rows.map((r) => r.vocabId);
}
