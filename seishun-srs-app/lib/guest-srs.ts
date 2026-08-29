// Guest SRS state manager — localStorage-backed, ephemeral
// Re-uses the SM-2 algorithm from lib/srs.ts so there's zero duplication.

import { calculateNextReview, type Grade } from "./srs";

// ── Storage keys ──────────────────────────────────────────────────────────────

const KEY_PROGRESS = "guest:srs:progress";
const KEY_BLACKLIST = "guest:srs:blacklist";
const KEY_REVIEW_COUNT = "guest:srs:reviewCount";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GuestProgress {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: string; // ISO string (JSON-safe)
  novelId: number;
  totalReviews: number;
}

export interface GuestStats {
  learned: number;
  due: number;
  totalReviews: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readMap(): Record<string, GuestProgress> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY_PROGRESS) ?? "{}");
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, GuestProgress>) {
  localStorage.setItem(KEY_PROGRESS, JSON.stringify(map));
}

function readBlacklist(): number[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY_BLACKLIST) ?? "[]");
  } catch {
    return [];
  }
}

function writeBlacklist(ids: number[]) {
  localStorage.setItem(KEY_BLACKLIST, JSON.stringify(ids));
}

function readReviewCount(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(KEY_REVIEW_COUNT) ?? "0", 10) || 0;
}

function incrementReviewCount() {
  localStorage.setItem(KEY_REVIEW_COUNT, String(readReviewCount() + 1));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Get SRS progress for a single vocab item, or null if never studied. */
export function getProgress(vocabId: number): GuestProgress | null {
  return readMap()[String(vocabId)] ?? null;
}

/** Save updated SRS progress for a vocab item. */
export function saveProgress(vocabId: number, state: GuestProgress) {
  const map = readMap();
  map[String(vocabId)] = state;
  writeMap(map);
}

/** Get all vocab IDs that have been studied at least once for a given novel. */
export function getLearnedVocabIds(novelId?: number): number[] {
  const map = readMap();
  return Object.entries(map)
    .filter(([, p]) => novelId === undefined || p.novelId === novelId)
    .map(([id]) => parseInt(id, 10));
}

/** Get vocab IDs that are due for review (nextReviewDate <= now). */
export function getDueVocabIds(novelId?: number): number[] {
  const map = readMap();
  const now = new Date();
  return Object.entries(map)
    .filter(([, p]) => {
      if (novelId !== undefined && p.novelId !== novelId) return false;
      return new Date(p.nextReviewDate) <= now;
    })
    .map(([id]) => parseInt(id, 10));
}

/** Get aggregate stats for a novel. */
export function getStats(novelId: number): GuestStats {
  const map = readMap();
  const now = new Date();
  let learned = 0;
  let due = 0;
  let totalReviews = 0;

  for (const p of Object.values(map)) {
    if (p.novelId !== novelId) continue;
    learned++;
    totalReviews += p.totalReviews;
    if (new Date(p.nextReviewDate) <= now) due++;
  }

  // Also count blacklisted items as "known"
  const bl = readBlacklist();
  // We can't filter blacklist by novel without extra metadata, so we count all
  // This is a minor simplification for guest mode

  return { learned: learned + bl.length, due, totalReviews };
}

/**
 * Record a review grade for a vocab item.
 * Runs the SM-2 algorithm client-side and saves the result.
 */
export function recordReview(vocabId: number, grade: Grade, novelId: number) {
  const existing = getProgress(vocabId);

  const currentState = existing
    ? {
        easeFactor: existing.easeFactor,
        interval: existing.interval,
        repetitions: existing.repetitions,
        nextReviewDate: new Date(existing.nextReviewDate),
      }
    : {
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextReviewDate: new Date(),
      };

  const next = calculateNextReview(currentState, grade);

  saveProgress(vocabId, {
    easeFactor: next.easeFactor,
    interval: next.interval,
    repetitions: next.repetitions,
    nextReviewDate: next.nextReviewDate.toISOString(),
    novelId,
    totalReviews: (existing?.totalReviews ?? 0) + 1,
  });

  incrementReviewCount();
}

/** Mark a vocab item as blacklisted (skipped permanently). */
export function blacklistVocab(vocabId: number) {
  const list = readBlacklist();
  if (!list.includes(vocabId)) {
    list.push(vocabId);
    writeBlacklist(list);
  }
}

/** Check if a vocab item is blacklisted. */
export function isBlacklisted(vocabId: number): boolean {
  return readBlacklist().includes(vocabId);
}

/** Get all blacklisted vocab IDs. */
export function getBlacklistedIds(): number[] {
  return readBlacklist();
}

/** Wipe all guest SRS data. */
export function clearAll() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_PROGRESS);
  localStorage.removeItem(KEY_BLACKLIST);
  localStorage.removeItem(KEY_REVIEW_COUNT);
}
