// ── Japanese language utilities and display helpers ────────────────────────────
import type { SRSStatus } from "./types";

/** Returns true if the character is a CJK kanji */
export function isKanji(char: string): boolean {
  const code = char.codePointAt(0)!;
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0xf900 && code <= 0xfaff)    // CJK Compatibility
  );
}

/** Extract unique kanji characters from a string */
export function extractKanji(text: string): string[] {
  return [...new Set(text.split("").filter(isKanji))];
}

/** Shorten verbose JMdict part-of-speech strings for display */
export function formatPOS(pos: string): string {
  return pos
    .replace("noun (common) (futsuumeishi)", "noun")
    .replace("na-adjective (keiyodoshi)", "na-adj")
    .replace("i-adjective (keiyoushi)", "i-adj")
    .replace("adverb (fukushi)", "adverb")
    .replace("adverb taking the `to' particle", "adverb-to")
    .replace("expressions (phrases, clauses, etc.)", "expression")
    .replace("noun or verb acting prenominally", "pre-noun")
    .replace("Godan verb with `u' ending", "Godan-u")
    .replace("Godan verb with `ru' ending", "Godan-ru")
    .replace("Godan verb", "Godan")
    .replace("Ichidan verb", "Ichidan")
    .replace("transitive verb", "transitive")
    .replace("intransitive verb", "intransitive")
    .replace("conjunction", "conj")
    .replace("particle", "particle")
    .replace("suffix", "suffix")
    .replace("prefix", "prefix");
}

/** JLPT level badge colours (Tailwind classes) */
export const JLPT_COLORS: Record<string, string> = {
  N1: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  N2: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  N3: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  N4: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  N5: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

/** JLPT level badge colours including border (for detail page hero) */
export const JLPT_COLORS_BORDER: Record<string, string> = {
  N1: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200",
  N2: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200",
  N3: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200",
  N4: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200",
  N5: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200",
};

/** Compute the SRS status label from a UserProgress record */
export function getSRSStatus(
  progress: { nextReviewDate: Date; interval: number; repetitions: number } | null,
  now: Date
): SRSStatus {
  if (!progress) return "new";
  if (progress.nextReviewDate <= now) return "due";
  if (progress.repetitions < 3) return "learning";
  return "learned";
}

export const SRS_BADGE: Record<SRSStatus, { label: string; cls: string }> = {
  new:      { label: "New",      cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  due:      { label: "Due",      cls: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" },
  learning: { label: "Learning", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  learned:  { label: "Learned",  cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
};
