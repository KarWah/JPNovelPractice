import { prisma } from "@/lib/prisma";
import Link from "next/link";
import StatCard from "@/components/StatCard";

export const dynamic = "force-dynamic";

async function getAnalytics() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Last 7 days of review counts
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const recentLogs = await prisma.reviewLog.findMany({
    where: { reviewedAt: { gte: sevenDaysAgo } },
    select: { reviewedAt: true, grade: true },
  });

  // Bucket by day
  const dayMap = new Map<string, { total: number; correct: number }>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { total: 0, correct: 0 });
  }
  for (const log of recentLogs) {
    const key = log.reviewedAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) {
      const entry = dayMap.get(key)!;
      entry.total++;
      if (log.grade >= 3) entry.correct++;
    }
  }
  const dailyReviews = Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    label: new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    }),
    ...data,
  }));

  // JLPT breakdown of learned words
  const jlptRows = await prisma.$queryRaw<{ level: string; count: bigint }[]>`
    SELECT v."jlptLevel" as level, COUNT(*) as count
    FROM "UserProgress" up
    JOIN "VocabEntry" v ON v.id = up."vocabId"
    GROUP BY v."jlptLevel"
    ORDER BY v."jlptLevel"
  `;

  // Overall stats
  const [totalLearned, totalVocab, totalBlacklisted, allTimeReviews] = await Promise.all([
    prisma.userProgress.count(),
    prisma.vocabEntry.count(),
    prisma.vocabEntry.count({ where: { blacklisted: true } }),
    prisma.reviewLog.count(),
  ]);

  // Streak: count consecutive days (from today going backwards) that have at least one review
  const logsWithDates = await prisma.reviewLog.findMany({
    select: { reviewedAt: true },
    orderBy: { reviewedAt: "desc" },
  });
  const reviewedDays = new Set(logsWithDates.map((l) => l.reviewedAt.toISOString().slice(0, 10)));
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (reviewedDays.has(key)) {
      streak++;
    } else {
      break;
    }
  }

  return {
    dailyReviews,
    jlptRows: jlptRows.map((r) => ({ level: r.level ?? "Unknown", count: Number(r.count) })),
    totalLearned,
    totalVocab,
    totalBlacklisted,
    allTimeReviews,
    streak,
  };
}

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  const maxDaily = Math.max(...data.dailyReviews.map((d) => d.total), 1);
  const todayReviews = data.dailyReviews[data.dailyReviews.length - 1]?.total ?? 0;

  const JLPT_ORDER = ["N5", "N4", "N3", "N2", "N1", "Unknown"];
  const jlptSorted = [...data.jlptRows].sort(
    (a, b) => JLPT_ORDER.indexOf(a.level) - JLPT_ORDER.indexOf(b.level)
  );
  const maxJlpt = Math.max(...jlptSorted.map((r) => r.count), 1);

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-12 gap-8">
      <div className="w-full max-w-lg">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 mb-4 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">Progress</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Your study analytics</p>
      </div>

      {/* Summary stats */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-4">
        <StatCard label="Words learned" value={data.totalLearned} accent="indigo" />
        <StatCard label="Reviews today" value={todayReviews} accent="yellow" />
        <StatCard label="All-time reviews" value={data.allTimeReviews} />
        <StatCard
          label="Study streak"
          value={`${data.streak} day${data.streak !== 1 ? "s" : ""}`}
          accent={data.streak > 0 ? "green" : undefined}
        />
        <div className="col-span-2">
          <StatCard
            label="Vocab coverage"
            value={`${data.totalLearned} / ${data.totalVocab}`}
            sub={`${Math.round((data.totalLearned / Math.max(data.totalVocab, 1)) * 100)}% of the novel`}
          />
        </div>
        {data.totalBlacklisted > 0 && (
          <div className="col-span-2">
            <StatCard
              label="Blacklisted (already known)"
              value={data.totalBlacklisted}
            />
          </div>
        )}
      </div>

      {/* 7-day review chart */}
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">
          Reviews — last 7 days
        </h2>
        <div className="flex items-end gap-2 h-28">
          {data.dailyReviews.map((day) => {
            const heightPct = day.total > 0 ? (day.total / maxDaily) * 100 : 0;
            const isToday = day.date === new Date().toISOString().slice(0, 10);
            return (
              <div key={day.date} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-xs text-zinc-400">{day.total > 0 ? day.total : ""}</span>
                <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
                  <div
                    className={`w-full rounded-t transition-all ${
                      isToday
                        ? "bg-indigo-500"
                        : day.total > 0
                        ? "bg-indigo-300 dark:bg-indigo-700"
                        : "bg-zinc-100 dark:bg-zinc-800"
                    }`}
                    style={{ height: `${Math.max(heightPct, day.total > 0 ? 4 : 2)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 truncate w-full text-center">
                  {day.label.split(",")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* JLPT breakdown */}
      {jlptSorted.length > 0 && (
        <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">
            Learned words by JLPT level
          </h2>
          <div className="space-y-3">
            {jlptSorted.map((row) => {
              const pct = Math.round((row.count / maxJlpt) * 100);
              const colorMap: Record<string, string> = {
                N5: "bg-green-400",
                N4: "bg-lime-400",
                N3: "bg-yellow-400",
                N2: "bg-orange-400",
                N1: "bg-red-400",
                Unknown: "bg-zinc-400",
              };
              const bar = colorMap[row.level] ?? "bg-zinc-400";
              return (
                <div key={row.level} className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 w-12">
                    {row.level}
                  </span>
                  <div className="flex-1 h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-500 w-10 text-right">{row.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

