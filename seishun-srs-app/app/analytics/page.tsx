import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import StatCard from "@/components/StatCard";

export const dynamic = "force-dynamic";

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function getAnalytics(userId: string) {
  const now = new Date();
  const todayKey = localDateKey(now);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const recentLogs = await prisma.reviewLog.findMany({
    where: { userId, reviewedAt: { gte: sevenDaysAgo } },
    select: { reviewedAt: true, grade: true },
  });

  const dayMap = new Map<string, { total: number; correct: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayMap.set(localDateKey(d), { total: 0, correct: 0 });
  }
  for (const log of recentLogs) {
    const key = localDateKey(log.reviewedAt);
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

  const [totalLearned, totalVocab, totalBlacklisted, allTimeReviews] = await Promise.all([
    prisma.userProgress.count({ where: { userId } }),
    prisma.vocabEntry.count(),
    prisma.vocabEntry.count({ where: { blacklisted: true } }),
    prisma.reviewLog.count({ where: { userId } }),
  ]);

  const logsWithDates = await prisma.reviewLog.findMany({
    where: { userId },
    select: { reviewedAt: true },
    orderBy: { reviewedAt: "desc" },
  });
  const reviewedDays = new Set(logsWithDates.map((l) => localDateKey(l.reviewedAt)));
  const startFrom = reviewedDays.has(todayKey) ? 0 : 1;
  let streak = 0;
  for (let i = startFrom; ; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (reviewedDays.has(localDateKey(d))) {
      streak++;
    } else {
      break;
    }
  }

  return { dailyReviews, todayKey, totalLearned, totalVocab, totalBlacklisted, allTimeReviews, streak };
}

export default async function AnalyticsPage() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Progress Analytics</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md">
            Sign up or log in to track your study streak, review history, and vocabulary coverage across all novels.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/register"
            className="px-6 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
          >
            Sign up free
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  const data = await getAnalytics(user.id);
  const maxDaily = Math.max(...data.dailyReviews.map((d) => d.total), 1);
  const todayReviews = data.dailyReviews.find((d) => d.date === data.todayKey)?.total ?? 0;

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-12 gap-8">
      <div className="w-full max-w-lg">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 mb-4 inline-block">
          ← Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">Progress</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Your study analytics</p>
      </div>

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
            <StatCard label="Blacklisted (already known)" value={data.totalBlacklisted} />
          </div>
        )}
      </div>

      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">
          Reviews — last 7 days
        </h2>
        <div className="flex items-end gap-2 h-28">
          {data.dailyReviews.map((day) => {
            const heightPct = day.total > 0 ? (day.total / maxDaily) * 100 : 0;
            const isToday = day.date === data.todayKey;
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
    </div>
  );
}
