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

export async function getNovelStats(
  novelId: number,
  userId: string | null | undefined,
): Promise<NovelStats> {
  if (!userId) {
    const totalVocab = await prisma.vocabEntry.count({ where: { novelId, blacklisted: false } });
    return { totalVocab, learnedCount: 0, dueCount: 0, newAvailableCount: 0, totalReviews: 0, maxSessionCards: 0 };
  }

  const now = new Date();
  const [totalVocab, learnedCount, dueCount, totalReviews, blacklistedCount] = await Promise.all([
    prisma.vocabEntry.count({ where: { novelId, blacklisted: false } }),
    prisma.userProgress.count({ where: { userId, vocab: { novelId } } }),
    prisma.userProgress.count({
      where: { userId, nextReviewDate: { lte: now }, vocab: { novelId, blacklisted: false } },
    }),
    prisma.reviewLog.count({ where: { userId, vocab: { novelId } } }),
    prisma.vocabEntry.count({ where: { novelId, blacklisted: true } }),
  ]);

  const learnedIds = await getLearnedVocabIds(novelId, userId);
  const newAvailableCount = await getNewWordsCount(novelId, learnedIds);

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

export async function getNovelSummary(
  novelId: number,
  userId: string | null | undefined,
): Promise<NovelSummary> {
  if (!userId) return { novelId, learned: 0, due: 0 };

  const now = new Date();
  const [learned, due, blacklisted] = await Promise.all([
    prisma.userProgress.count({ where: { userId, vocab: { novelId } } }),
    prisma.userProgress.count({
      where: { userId, vocab: { novelId }, nextReviewDate: { lte: now } },
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

export async function getReviewQueue(
  novelId: number,
  count: number,
  userId: string,
): Promise<ReviewQueue> {
  const now = new Date();

  const due = await prisma.userProgress.findMany({
    where: {
      userId,
      nextReviewDate: { lte: now },
      vocab: { novelId, blacklisted: false },
    },
    orderBy: { nextReviewDate: "asc" },
    take: count,
    include: { vocab: { include: { sentences: true } } },
  }) as { vocab: VocabCardEntry }[];

  const newWordSlots = Math.max(0, count - due.length);
  const newWords = newWordSlots > 0
    ? await getNewWords(novelId, newWordSlots, userId)
    : [];

  return { due, newWords };
}

// ── New words (not yet in this user's UserProgress) ───────────────────────────

export async function getNewWords(
  novelId: number,
  limit: number,
  userId: string,
  learnedIds?: number[],
): Promise<VocabCardEntry[]> {
  const ids = learnedIds ?? await getLearnedVocabIds(novelId, userId);
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
}

async function getNewWordsCount(novelId: number, learnedIds: number[]): Promise<number> {
  return prisma.vocabEntry.count({
    where: {
      novelId,
      blacklisted: false,
      id: { notIn: learnedIds.length ? learnedIds : [-1] },
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function getLearnedVocabIds(
  novelId: number | undefined,
  userId: string,
): Promise<number[]> {
  const rows = await prisma.userProgress.findMany({
    select: { vocabId: true },
    where: {
      userId,
      ...(novelId !== undefined ? { vocab: { novelId } } : {}),
    },
  });
  return rows.map((r) => r.vocabId);
}
