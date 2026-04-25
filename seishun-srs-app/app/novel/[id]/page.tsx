import { isAdmin } from "@/lib/auth";
import { adminPrisma, demoPrisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import SessionStarter from "@/components/SessionStarter";
import CrossNovelSetup from "@/components/CrossNovelSetup";
import StatCard from "@/components/StatCard";
import { getNovelStats } from "@/lib/repositories/vocab";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function NovelDashboardContent({ novelId, admin }: { novelId: number; admin: boolean }) {
  try {
    const db = admin ? adminPrisma : demoPrisma;
    const [novel, stats, otherNovelProgress] = await Promise.all([
      db.novel.findUnique({ where: { id: novelId } }),
      getNovelStats(novelId, db),
      db.userProgress.count({ where: { vocab: { novelId: { not: novelId } } } }),
    ]);

    if (!novel) return <div>Novel not found</div>;

    const isNewNovel = stats.learnedCount === 0;
    const hasKnownFromOtherNovels = isNewNovel && otherNovelProgress > 0;

    const { totalVocab, learnedCount, dueCount, newAvailableCount, totalReviews, maxSessionCards } = stats;
    const coveragePct = Math.round((learnedCount / Math.max(totalVocab, 1)) * 100);

    return (
      <>
        {/* Breadcrumb */}
        <div className="w-full max-w-lg">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
            ← All novels
          </Link>
        </div>

        {/* Hero — cover + title */}
        <div className="w-full max-w-lg flex gap-5 items-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-5 shadow-sm">
          {novel.coverImage && (
            <div className="relative w-20 h-28 shrink-0 rounded-lg overflow-hidden shadow">
              <Image
                src={`/${novel.coverImage}`}
                alt={novel.title}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 leading-snug">
              {novel.title}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">{totalVocab} words total</p>
          </div>
        </div>

        {/* Cross-novel setup (shown when starting a new novel with prior known words) */}
        {admin && isNewNovel && hasKnownFromOtherNovels && (
          <CrossNovelSetup novelId={novelId} />
        )}

        {/* Stats grid */}
        <div className="w-full max-w-lg grid grid-cols-2 gap-4">
          <StatCard label="Due for review" value={dueCount} accent="indigo" />
          <StatCard label="New available" value={newAvailableCount} accent="yellow" />
          <StatCard label="Learned" value={learnedCount} />
          <StatCard label="Total reviews" value={totalReviews} />
          <div className="col-span-2">
            <StatCard
              label="Coverage"
              value={`${learnedCount} / ${totalVocab}`}
              sub={`${coveragePct}% of this novel`}
            />
          </div>
        </div>

        {/* Session starter with slider (admin only — requires UserProgress writes) */}
        {admin ? (
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">
              Start a session
            </h2>
            <SessionStarter novelId={novelId} maxAvailable={maxSessionCards} />
          </div>
        ) : (
          <div className="w-full max-w-lg bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 text-center">
            <p className="text-sm text-zinc-400">
              This is a demo — study sessions are disabled for visitors.
            </p>
          </div>
        )}

        {/* Secondary actions */}
        <div className="w-full max-w-lg flex flex-col gap-3">
          <Link
            href={`/vocab?novelId=${novelId}`}
            className="flex items-center justify-center w-full py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
          >
            Browse vocabulary
          </Link>
          <Link
            href="/analytics"
            className="flex items-center justify-center w-full py-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium transition-colors"
          >
            View progress
          </Link>
        </div>

        {/* Advanced: manual cross-novel blacklist re-check (admin only) */}
        {admin && <CrossNovelSetup novelId={novelId} showAsButton />}
      </>
    );
  } catch (e) {
    console.error(e);
    return <div>Error loading novel</div>;
  }
}

function LoadingContent() {
  return (
    <div className="w-full max-w-lg flex flex-col gap-4 animate-pulse">
      <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
      <div className="h-28 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default async function NovelDashboard({ params }: PageProps) {
  const { id } = await params;
  const novelId = parseInt(id);
  if (isNaN(novelId)) notFound();

  const admin = await isAdmin();

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-10 gap-8">
      <Suspense fallback={<LoadingContent />}>
        <NovelDashboardContent novelId={novelId} admin={admin} />
      </Suspense>
    </div>
  );
}
