import { prisma } from "@/lib/prisma";

/** Mark a single vocab entry as blacklisted (excluded from reviews) */
export async function blacklist(vocabId: number): Promise<void> {
  await prisma.vocabEntry.update({
    where: { id: vocabId },
    data: { blacklisted: true },
  });
}

/** Remove the blacklist flag from a vocab entry */
export async function unblacklist(vocabId: number): Promise<void> {
  await prisma.vocabEntry.update({
    where: { id: vocabId },
    data: { blacklisted: false },
  });
}

/**
 * Blacklists entries in `novelId` that share a kana (or kanji) with a word
 * already in UserProgress from any *other* novel, OR that are already
 * blacklisted in another novel (manually marked as "I know this").
 *
 * This operation is idempotent — running it multiple times is safe.
 * Returns the number of newly blacklisted entries.
 */
export async function blacklistCrossNovel(novelId: number): Promise<number> {
  const knownVocab = await prisma.vocabEntry.findMany({
    where: {
      novelId: { not: novelId },
      OR: [
        { progress: { isNot: null } },
        { blacklisted: true },
      ],
    },
    select: { kana: true, kanji: true },
    distinct: ["kana", "kanji"],
  });

  if (knownVocab.length === 0) return 0;

  const knownKana  = knownVocab.map((v) => v.kana);
  const knownKanji = knownVocab
    .map((v) => v.kanji)
    .filter((k): k is string => !!k);

  // 2. Find not-yet-blacklisted entries in this novel that overlap
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
