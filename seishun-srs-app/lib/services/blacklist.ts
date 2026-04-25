import { prisma } from "@/lib/prisma";

export async function blacklist(vocabId: number): Promise<void> {
  await prisma.vocabEntry.update({ where: { id: vocabId }, data: { blacklisted: true } });
}

export async function unblacklist(vocabId: number): Promise<void> {
  await prisma.vocabEntry.update({ where: { id: vocabId }, data: { blacklisted: false } });
}

/**
 * Blacklists entries in `novelId` that share a kana/kanji with a word this
 * user has already studied in another novel, or that are globally blacklisted.
 * Returns the number of newly blacklisted entries.
 */
export async function blacklistCrossNovel(novelId: number, userId: string): Promise<number> {
  const knownVocab = await prisma.vocabEntry.findMany({
    where: {
      novelId: { not: novelId },
      OR: [
        { progress: { some: { userId } } },
        { blacklisted: true },
      ],
    },
    select: { kana: true, kanji: true },
    distinct: ["kana", "kanji"],
  });

  if (knownVocab.length === 0) return 0;

  const knownKana  = knownVocab.map((v) => v.kana);
  const knownKanji = knownVocab.map((v) => v.kanji).filter((k): k is string => !!k);

  const toBlacklist = await prisma.vocabEntry.findMany({
    where: {
      novelId,
      blacklisted: false,
      OR: [
        { kana: { in: knownKana } },
        ...(knownKanji.length > 0 ? [{ kanji: { in: knownKanji } }] : []),
      ],
    },
    select: { id: true },
  });

  if (toBlacklist.length === 0) return 0;

  await prisma.vocabEntry.updateMany({
    where: { id: { in: toBlacklist.map((v) => v.id) } },
    data: { blacklisted: true },
  });

  return toBlacklist.length;
}
