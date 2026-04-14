"use client";

import FuriganaText from "./FuriganaText";
import Link from "next/link";
import type { VocabCardEntry } from "@/lib/types";

interface VocabCardProps {
  entry: VocabCardEntry;
  revealed: boolean;
  onReveal: () => void;
}

export default function VocabCard({ entry, revealed, onReveal }: VocabCardProps) {
  const display = entry.kanji ?? entry.kana;
  const primaryReading = entry.allReadings[0] ?? entry.kana;
  const meanings = entry.allMeanings.length > 0 ? entry.allMeanings : [entry.meaning];

  return (
    <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
      {/* Front — always visible */}
      <div className="flex flex-col items-center gap-2 px-8 pt-10 pb-6">
        <p className="text-5xl font-bold tracking-wide text-zinc-900 dark:text-zinc-50">
          {display}
        </p>
        {primaryReading !== display && (
          <p className="text-lg text-zinc-500 dark:text-zinc-400">{primaryReading}</p>
        )}
        {entry.jlptLevel && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
            {entry.jlptLevel}
          </span>
        )}
      </div>

      {/* Reveal button */}
      {!revealed && (
        <div className="px-8 pb-8 flex justify-center">
          <button
            onClick={onReveal}
            className="px-8 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-full font-semibold hover:opacity-80 transition-opacity"
          >
            Show Answer
          </button>
        </div>
      )}

      {/* Back — revealed */}
      {revealed && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-8 py-6 space-y-4">
          {/* All readings */}
          {entry.allReadings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                Readings
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.allReadings.map((r) => (
                  <span
                    key={r}
                    className="text-sm px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Meanings */}
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Meanings
            </p>
            <ol className="space-y-1">
              {meanings.map((m, i) => (
                <li key={i} className="text-sm text-zinc-800 dark:text-zinc-200 leading-snug">
                  {meanings.length > 1 && (
                    <span className="text-zinc-400 mr-1">{i + 1}.</span>
                  )}
                  {m}
                </li>
              ))}
            </ol>
          </div>

          {/* Parts of speech */}
          {entry.partsOfSpeech.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.partsOfSpeech.map((pos) => (
                <span
                  key={pos}
                  className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                >
                  {pos}
                </span>
              ))}
            </div>
          )}

          {/* Example sentences */}
          {entry.sentences.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                Example
              </p>
              <div className="space-y-2">
                {entry.sentences.slice(0, 2).map((s) => (
                  <div key={s.id} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg px-4 py-3">
                    <p className="text-base text-zinc-800 dark:text-zinc-200">
                      <FuriganaText text={s.japaneseText} />
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      {s.englishTrans}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-1">
            <Link
              href={`/vocab/${entry.id}`}
              className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              View full details →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
