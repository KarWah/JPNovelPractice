// ── Shared DTOs used across pages, components, and API routes ─────────────────

export interface Sentence {
  id: number;
  japaneseText: string;
  englishTrans: string;
}

/** Shape returned from the review API and used by study session + VocabCard */
export interface VocabCardEntry {
  id: number;
  kanji: string | null;
  kana: string;
  meaning: string;
  jlptLevel: string | null;
  partsOfSpeech: string[];
  allReadings: string[];
  allMeanings: string[];
  sentences: Sentence[];
}

/** Context object passed to the AI tutor */
export interface VocabContext {
  word: string;
  reading: string;
  meaning: string;
  partsOfSpeech: string[];
}

/** SRS card status used in the vocab browse page */
export type SRSStatus = "new" | "due" | "learning" | "learned";

/** A single card in a study session (may be new or a due review) */
export interface SessionCard {
  entry: VocabCardEntry;
  isNew: boolean;
}
