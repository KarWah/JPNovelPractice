import { getDb, isAdmin } from "@/lib/auth";
import NovelGrid from "@/components/NovelGrid";
import type { NovelGridItem } from "@/components/NovelGrid";
import { getNovelSummary } from "@/lib/repositories/vocab";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const db = await getDb();
  const admin = await isAdmin();

  const novels = await db.novel.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { vocabEntries: true } },
    },
  });

  const summaries = await Promise.all(novels.map((n) => getNovelSummary(n.id, db)));
  const statsMap = Object.fromEntries(summaries.map((s) => [s.novelId, s]));

  const items: NovelGridItem[] = novels.map((novel) => {
    const stats = statsMap[novel.id];
    return {
      id:         novel.id,
      slug:       novel.slug,
      title:      novel.title,
      coverImage: novel.coverImage,
      sortOrder:  novel.sortOrder,
      totalVocab: novel._count.vocabEntries,
      learned:    stats.learned,
      due:        stats.due,
    };
  });

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

      <NovelGrid initialNovels={items} isAdmin={admin} />
    </div>
  );
}
