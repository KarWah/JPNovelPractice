"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SESSION_MIN = 10;
const SESSION_MAX = 50;

interface SessionStarterProps {
  novelId: number;
  /** Total cards currently available (due + new words) */
  maxAvailable: number;
}

export default function SessionStarter({ novelId, maxAvailable }: SessionStarterProps) {
  const router = useRouter();

  // Effective upper bound: the lesser of our hard cap and what's actually ready
  const effectiveMax = Math.min(SESSION_MAX, Math.max(maxAvailable, SESSION_MIN));
  const defaultCount = Math.min(20, effectiveMax);
  const [count, setCount] = useState(defaultCount);

  const handleStart = () => {
    router.push(`/study?novelId=${novelId}&count=${count}`);
  };

  if (maxAvailable === 0) {
    return (
      <div className="w-full py-5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-center text-zinc-400 font-medium">
        Nothing due right now — come back later!
      </div>
    );
  }

  const atCeiling = maxAvailable < SESSION_MIN;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Cards per session
        </label>
        <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 w-12 text-right">
          {count}
        </span>
      </div>

      <input
        type="range"
        min={SESSION_MIN}
        max={effectiveMax}
        value={count}
        onChange={(e) => setCount(parseInt(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-indigo-600 bg-zinc-200 dark:bg-zinc-700"
      />

      <div className="flex justify-between text-xs text-zinc-400">
        <span>{SESSION_MIN}</span>
        <span>
          {atCeiling
            ? `Only ${maxAvailable} ready today`
            : `${maxAvailable} cards in queue`}
        </span>
        <span>{effectiveMax}</span>
      </div>

      <button
        onClick={handleStart}
        className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-lg transition-colors"
      >
        Start studying ({count} cards)
      </button>
    </div>
  );
}
