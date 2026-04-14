"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import VocabCard from "@/components/VocabCard";
import ReviewButtons from "@/components/ReviewButtons";
import TutorDrawer from "@/components/TutorDrawer";
import type { Grade } from "@/lib/srs";
import type { SessionCard, VocabCardEntry } from "@/lib/types";
import Link from "next/link";

interface ReviewData {
  due: { vocab: VocabCardEntry }[];
  newWords: VocabCardEntry[];
}

// How many times a card can be re-queued in one session after "Again"
const MAX_REQUEUES = 2;

export default function StudyPage() {
  const searchParams = useSearchParams();
  const novelId = searchParams.get("novelId") ?? "1";
  const count = searchParams.get("count") ?? "20";

  const [cards, setCards] = useState<SessionCard[]>([]);
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0 });
  // Track how many times each card has been re-queued this session
  const requeueCount = useRef<Map<number, number>>(new Map());

  const loadCards = useCallback(() => {
    setLoading(true);
    setSessionDone(false);
    setCurrent(0);
    setRevealed(false);
    setStats({ reviewed: 0, correct: 0 });
    requeueCount.current = new Map();

    fetch(`/api/review?novelId=${novelId}&count=${count}`)
      .then((r) => r.json())
      .then((data: ReviewData) => {
        const dueCards = data.due.map((d) => ({ entry: d.vocab, isNew: false }));
        const newCards = data.newWords.map((w) => ({ entry: w, isNew: true }));
        setCards([...dueCards, ...newCards]);
        setLoading(false);
      });
  }, [novelId, count]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const advance = useCallback(
    (updatedCards: SessionCard[], nextIndex: number) => {
      if (nextIndex >= updatedCards.length) {
        setSessionDone(true);
      } else {
        setCards(updatedCards);
        setCurrent(nextIndex);
        setRevealed(false);
      }
    },
    []
  );

  const handleGrade = useCallback(
    async (grade: Grade) => {
      if (!cards[current]) return;
      setSubmitting(true);

      const card = cards[current];

      // Only persist to DB when the card is done for the session:
      // — "Again" but already re-queued MAX_REQUEUES times → persist and move on
      // — "Again" with requeues remaining → re-queue WITHOUT persisting yet
      // — Any other grade → always persist
      const fails = requeueCount.current.get(card.entry.id) ?? 0;
      const shouldPersist = grade !== 1 || fails >= MAX_REQUEUES;

      if (shouldPersist) {
        await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vocabId: card.entry.id, grade }),
        });
      }

      const isCorrect = grade >= 3;
      setStats((s) => ({
        reviewed: s.reviewed + 1,
        correct: s.correct + (isCorrect ? 1 : 0),
      }));

      let updatedCards = [...cards];
      if (grade === 1 && fails < MAX_REQUEUES) {
        // Re-queue: remove the card from the current position and insert it
        // ~4 positions ahead (or at the end if close to done)
        requeueCount.current.set(card.entry.id, fails + 1);
        updatedCards.splice(current, 1);
        const insertAt = Math.min(current + 4, updatedCards.length);
        updatedCards.splice(insertAt, 0, card);
        // Stay at the same index (which now points to the next card)
        advance(updatedCards, current < updatedCards.length ? current : 0);
      } else {
        advance(updatedCards, current + 1);
      }

      setSubmitting(false);
    },
    [cards, current, advance]
  );

  const handleBlacklist = useCallback(async () => {
    if (!cards[current]) return;
    setSubmitting(true);

    await fetch("/api/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vocabId: cards[current].entry.id }),
    });

    const updatedCards = [...cards];
    updatedCards.splice(current, 1);
    advance(updatedCards, current < updatedCards.length ? current : 0);
    setSubmitting(false);
  }, [cards, current, advance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-400">Loading session...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-2xl font-semibold text-zinc-700 dark:text-zinc-300">
          Nothing due right now!
        </p>
        <p className="text-zinc-500">Check back later or browse your vocabulary.</p>
        <Link
          href={`/novel/${novelId}`}
          className="mt-4 px-6 py-2 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium hover:opacity-80 transition-opacity"
        >
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (sessionDone) {
    const accuracy = stats.reviewed > 0 ? Math.round((stats.correct / stats.reviewed) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">Session Complete!</h1>
        <div className="grid grid-cols-2 gap-4 text-center w-full max-w-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow border border-zinc-200 dark:border-zinc-700">
            <p className="text-4xl font-bold text-zinc-800 dark:text-zinc-100">{stats.reviewed}</p>
            <p className="text-sm text-zinc-500 mt-1">Cards reviewed</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow border border-zinc-200 dark:border-zinc-700">
            <p className="text-4xl font-bold text-green-600">{accuracy}%</p>
            <p className="text-sm text-zinc-500 mt-1">Accuracy</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={loadCards}
            className="w-full px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
          >
            Keep Studying
          </button>
          <Link
            href="/analytics"
            className="w-full px-6 py-3 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            View Progress
          </Link>
          <Link
            href={`/novel/${novelId}`}
            className="w-full px-6 py-3 rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-semibold text-center hover:opacity-80 transition-opacity"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const card = cards[current];
  const progress = ((current / cards.length) * 100).toFixed(0);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-8 gap-6">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between">
        <Link
          href={`/novel/${novelId}`}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          ← Dashboard
        </Link>
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          {card.isNew && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
              New
            </span>
          )}
          {(requeueCount.current.get(card.entry.id) ?? 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
              Again
            </span>
          )}
          <span>
            {current + 1} / {cards.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-lg h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card */}
      <VocabCard
        entry={card.entry}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
      />

      {/* Grade buttons (only shown after reveal) */}
      {revealed && (
        <ReviewButtons onGrade={handleGrade} disabled={submitting} />
      )}

      {/* Blacklist */}
      <button
        onClick={handleBlacklist}
        disabled={submitting}
        className="text-xs text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-40"
      >
        I already know this word — skip permanently
      </button>

      {/* AI Tutor */}
      <TutorDrawer
        vocabContext={{
          word: card.entry.kanji ?? card.entry.kana,
          reading: card.entry.allReadings[0] ?? card.entry.kana,
          meaning: card.entry.meaning,
          partsOfSpeech: card.entry.partsOfSpeech,
        }}
      />
    </div>
  );
}
