import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { getNovelSummary } from "@/lib/repositories/vocab";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const novels = await prisma.novel.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { vocabEntries: true } },
    },
  });

  // Per-novel progress counts via shared repository
  const novelStats = await Promise.all(novels.map((n) => getNovelSummary(n.id)));
  const statsMap = Object.fromEntries(novelStats.map((s) => [s.novelId, s]));

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-16 gap-10">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
          Choose a novel
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Select the novel you want to study vocabulary for
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
        {novels.map((novel) => {
          const stats = statsMap[novel.id];
          return (
            <Link
              key={novel.id}
              href={`/novel/${novel.id}`}
              className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-200"
            >
              {/* Cover image */}
              <div className="relative w-full aspect-[2/3] bg-zinc-100 dark:bg-zinc-800">
                {novel.coverImage ? (
                  <Image
                    src={`/${novel.coverImage}`}
                    alt={novel.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    priority={novel.sortOrder === 1}
                    loading={novel.sortOrder === 1 ? "eager" : "lazy"}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-4xl text-zinc-300">
                    📖
                  </div>
                )}
                {/* Due badge */}
                {stats.due > 0 && (
                  <div className="absolute top-3 right-3 bg-indigo-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                    {stats.due} due
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-snug mb-2">
                  {novel.title}
                </h2>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{stats.learned} / {novel._count.vocabEntries} learned</span>
                  <div className="w-24 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{
                        width: `${Math.round((stats.learned / Math.max(novel._count.vocabEntries, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {/* Add novel tile */}
        <Link
          href="/novels/new"
          className="group relative bg-white dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-600 overflow-hidden transition-all duration-200 flex flex-col items-center justify-center gap-3 min-h-[280px]"
        >
          <div className="text-4xl text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-400 transition-colors">
            +
          </div>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 group-hover:text-indigo-500 transition-colors">
            Add novel
          </p>
        </Link>
      </div>
    </div>
  );
}
