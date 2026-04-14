// SuperMemo-2 (SM-2) spaced repetition algorithm
// Grade scale: 1=Again, 2=Hard, 3=Good, 4=Easy

export type Grade = 1 | 2 | 3 | 4;

export interface SRSState {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

const MIN_EASE = 1.3;

export function calculateNextReview(state: SRSState, grade: Grade): SRSState {
  const { easeFactor, interval, repetitions } = state;

  // "Again" — reset to relearn; interval drops to 1 day so it comes back tomorrow.
  // The study session itself is responsible for re-queuing the card within the
  // same session (up to 2 re-shows) before persisting this state to the DB.
  if (grade === 1) {
    return {
      easeFactor: Math.max(MIN_EASE, easeFactor - 0.2),
      interval: 1,
      repetitions: 0,
      nextReviewDate: addDays(new Date(), 1),
    };
  }

  let newInterval: number;
  let newEaseFactor = easeFactor;
  let newRepetitions = repetitions + 1;

  // Ease factor adjustment per grade
  // Hard: -0.15, Good: +0, Easy: +0.15
  const easeAdjustment = grade === 2 ? -0.15 : grade === 4 ? 0.15 : 0;
  newEaseFactor = Math.max(MIN_EASE, easeFactor + easeAdjustment);

  if (repetitions === 0) {
    newInterval = 1;
  } else if (repetitions === 1) {
    newInterval = grade === 2 ? 1 : 6;
  } else {
    newInterval = Math.round(interval * newEaseFactor);
    // Hard caps interval growth
    if (grade === 2) newInterval = Math.round(interval * 1.2);
    // Easy adds a bonus day
    if (grade === 4) newInterval = Math.round(interval * newEaseFactor) + 1;
  }

  return {
    easeFactor: newEaseFactor,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate: addDays(new Date(), newInterval),
  };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export const GRADE_LABELS: Record<Grade, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

export const GRADE_DESCRIPTIONS: Record<Grade, string> = {
  1: "Complete blackout",
  2: "Remembered with difficulty",
  3: "Remembered correctly",
  4: "Remembered perfectly",
};
