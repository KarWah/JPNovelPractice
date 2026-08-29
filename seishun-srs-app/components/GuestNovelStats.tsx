"use client";

import { useEffect, useState } from "react";
import { getStats, getLearnedVocabIds, getBlacklistedIds } from "@/lib/guest-srs";
import StatCard from "./StatCard";
import SessionStarter from "./SessionStarter";

interface Props {
  novelId: number;
  totalVocab: number;
}

export default function GuestNovelStats({ novelId, totalVocab }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [learned, setLearned] = useState(0);
  const [due, setDue] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [newAvailable, setNewAvailable] = useState(0);

  useEffect(() => {
    const guestStats = getStats(novelId);
    const learnedIds = getLearnedVocabIds(novelId);
    const blacklistedIds = getBlacklistedIds();
    const knownCount = learnedIds.length + blacklistedIds.length;

    setLearned(guestStats.learned);
    setDue(guestStats.due);
    setTotalReviews(guestStats.totalReviews);
    setNewAvailable(Math.max(0, totalVocab - knownCount));
    setLoaded(true);
  }, [novelId, totalVocab]);

  if (!loaded) {
    return (
      <div className="w-full max-w-lg grid grid-cols-2 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        ))}
      </div>
    );
  }

  const coveragePct = Math.round((learned / Math.max(totalVocab, 1)) * 100);
  const maxSessionCards = due + newAvailable;

  return (
    <>
      <div className="w-full max-w-lg grid grid-cols-2 gap-4">
        <StatCard label="Due for review" value={due} accent="indigo" />
        <StatCard label="New available" value={newAvailable} accent="yellow" />
        <StatCard label="Learned" value={learned} />
        <StatCard label="Total reviews" value={totalReviews} />
        <div className="col-span-2">
          <StatCard
            label="Coverage"
            value={`${learned} / ${totalVocab}`}
            sub={`${coveragePct}% of this novel`}
          />
        </div>
      </div>

      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">
          Start a session
        </h2>
        <SessionStarter novelId={novelId} maxAvailable={maxSessionCards} />
      </div>

      <div className="w-full max-w-lg rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-center">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          🔒 Your progress is saved in this browser only.{" "}
          <a href="/register" className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100">
            Sign up
          </a>{" "}
          to save it permanently.
        </p>
      </div>
    </>
  );
}
