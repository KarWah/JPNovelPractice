import { PrismaClient } from "@prisma/client";
import { adminPrisma } from "@/lib/prisma";
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
  db: PrismaClient = adminPrisma
): Promise<NovelStats> {
  const now = new Date();

  const [totalVocab, learnedCount, dueCount, totalReviews, blacklistedCount] = await Promise.all([
    db.vocabEntry.count({ where: { novelId, blacklisted: false } }),
    db.userProgress.count({ where: { vocab: { novelId } } }),
    db.userProgress.count({
      where: { nextReviewDate: { lte: now }, vocab: { novelId, blacklisted: false } },
    }),
    db.reviewLog.count({ where: { vocab: { novelId } } }),
    db.vocabEntry.count({ where: { novelId, blacklisted: true } }),
  ]);

  const learnedIds = await getLearnedVocabIds(novelId, db);
  const newAvailableCount = await getNewWordsCount(novelId, learnedIds, db);

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
  db: PrismaClient = adminPrisma
): Promise<NovelSummary> {
  const now = new Date();
  const [learned, due, blacklisted] = await Promise.all([
    db.userProgress.count({ where: { vocab: { novelId } } }),
    db.userProgress.count({
      where: { vocab: { novelId }, nextReviewDate: { lte: now } },
    }),
    db.vocabEntry.count({ where: { novelId, blacklisted: true } }),
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
  db: PrismaClient = adminPrisma
): Promise<ReviewQueue> {
  const now = new Date();

  const due = await db.userProgress.findMany({
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
      ? await getNewWords(novelId, newWordSlots, undefined, db)
      : [];

  return { due, newWords };
}

// ── New words (not yet in UserProgress) ───────────────────────────────────────

export async function getNewWords(
  novelId: number,
  limit: number,
  learnedIds?: number[],
  db: PrismaClient = adminPrisma
): Promise<VocabCardEntry[]> {
  const ids = learnedIds ?? await getLearnedVocabIds(novelId, db);
  return db.vocabEntry.findMany({
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

async function getNewWordsCount(
  novelId: number,
  learnedIds: number[],
  db: PrismaClient = adminPrisma
): Promise<number> {
  return db.vocabEntry.count({
    where: {
      novelId,
      blacklisted: false,
      id: { notIn: learnedIds.length ? learnedIds : [-1] },
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function getLearnedVocabIds(
  novelId?: number,
  db: PrismaClient = adminPrisma
): Promise<number[]> {
  const rows = await db.userProgress.findMany({
    select: { vocabId: true },
    ...(novelId ? { where: { vocab: { novelId } } } : {}),
  });
  return rows.map((r) => r.vocabId);
}
