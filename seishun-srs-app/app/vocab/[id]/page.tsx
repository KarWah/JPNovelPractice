import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import FuriganaText from "@/components/FuriganaText";
import TutorDrawer from "@/components/TutorDrawer";
import { JLPT_COLORS_BORDER, formatPOS, extractKanji } from "@/lib/jp";
import { addToStudyDeck, blacklistWord, unblacklistWord } from "./actions";
import { StartStudyButton } from "./StartStudyButton";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VocabDetailPage({ params }: PageProps) {
  const { id } = await params;
  const entryId = parseInt(id);
  if (isNaN(entryId)) notFound();

  const entry = await prisma.vocabEntry.findUnique({
    where: { id: entryId },
    include: {
      sentences: true,
      progress: true,
    },
  });

  if (!entry) notFound();

  // Fetch kanji breakdown for every kanji character in the word
  const kanjiChars = extractKanji(entry.kanji ?? entry.kana);
  const kanjiData = await prisma.kanjiEntry.findMany({
    where: { character: { in: kanjiChars } },
  });
  const kanjiMap = Object.fromEntries(kanjiData.map((k) => [k.character, k]));

  // Neighbouring words for prev/next navigation
  const [prevEntry, nextEntry] = await Promise.all([
    prisma.vocabEntry.findFirst({
      where: { occurrences: { gt: entry.occurrences } },
      orderBy: [{ occurrences: "asc" }, { id: "asc" }],
      select: { id: true, kanji: true, kana: true },
    }),
    prisma.vocabEntry.findFirst({
      where: { occurrences: { lt: entry.occurrences } },
      orderBy: [{ occurrences: "desc" }, { id: "desc" }],
      select: { id: true, kanji: true, kana: true },
    }),
  ]);

  const displayWord = entry.kanji ?? entry.kana;
  // Primary kana reading — from JMdict allReadings if enriched, else kana field
  // (kana field may contain kanji+kana like "言う"; allReadings has pure kana "いう")
  const primaryReading = entry.allReadings[0] ?? entry.kana;
  const showReading = primaryReading !== displayWord;

  const vocabContext = {
    word: displayWord,
    reading: primaryReading,
    meaning: entry.meaning,
    partsOfSpeech: entry.partsOfSpeech,
  };

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8 pb-24">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400 mb-8">
        <Link href="/" className="hover:text-zinc-600 transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <Link
          href={entry.novelId ? `/vocab?novelId=${entry.novelId}` : "/vocab"}
          className="hover:text-zinc-600 transition-colors"
        >
          Vocabulary
        </Link>
        <span>/</span>
        <span className="text-zinc-600 dark:text-zinc-300">{displayWord}</span>
      </div>

      {/* ── Hero ── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-5xl font-bold text-zinc-900 dark:text-zinc-50 tracking-wide mb-2">
              {displayWord}
            </h1>
            {showReading && (
              <p className="text-xl text-zinc-400 dark:text-zinc-500">{primaryReading}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {entry.jlptLevel && (
              <span
                className={`text-sm font-bold px-3 py-1 rounded-full border ${
                  JLPT_COLORS_BORDER[entry.jlptLevel] ?? ""
                }`}
              >
                {entry.jlptLevel}
              </span>
            )}
            {entry.tags.includes("uk") && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                usually kana
              </span>
            )}
          </div>
        </div>

        {/* All readings — show if enriched and more than one, or if reading differs from written form */}
        {entry.allReadings.length > 0 && (entry.allReadings.length > 1 || showReading) && (
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-2">
              Readings
            </p>
            <div className="flex flex-wrap gap-2">
              {entry.allReadings.map((r) => (
                <span
                  key={r}
                  className={`text-sm px-2.5 py-1 rounded-lg border ${
                    r === primaryReading
                      ? "border-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-semibold"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Meanings ── */}
      <Section title="Meanings">
        {entry.allMeanings.length > 0 ? (
          <ol className="space-y-2">
            {entry.allMeanings.map((m, i) => (
              <MeaningRow key={i} index={i + 1} text={m} />
            ))}
          </ol>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-300">{entry.meaning}</p>
        )}
      </Section>

      {/* ── Kanji breakdown ── */}
      {kanjiChars.length > 0 && (
        <Section title="Kanji breakdown">
          <div className="space-y-4">
            {kanjiChars.map((char) => {
              const k = kanjiMap[char];
              return (
                <div
                  key={char}
                  className="flex gap-4 items-start p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl"
                >
                  {/* Character */}
                  <div className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 w-12 shrink-0 text-center">
                    {char}
                  </div>
                  {k ? (
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      {/* On'yomi */}
                      {k.onyomi.length > 0 && (
                        <div className="flex gap-2 items-baseline flex-wrap">
                          <span className="text-xs font-semibold text-zinc-400 w-14 shrink-0">
                            On'yomi
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {k.onyomi.map((r) => (
                              <span
                                key={r}
                                className="text-sm font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Kun'yomi */}
                      {k.kunyomi.length > 0 && (
                        <div className="flex gap-2 items-baseline flex-wrap">
                          <span className="text-xs font-semibold text-zinc-400 w-14 shrink-0">
                            Kun'yomi
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {k.kunyomi.map((r) => (
                              <span
                                key={r}
                                className="text-sm font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-900/30 px-2 py-0.5 rounded"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Meanings */}
                      {k.meanings.length > 0 && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {k.meanings.join(", ")}
                        </p>
                      )}
                      {/* Meta */}
                      <div className="flex gap-3 mt-0.5">
                        {k.jlptLevel && (
                          <span className="text-[10px] text-zinc-400">{k.jlptLevel}</span>
                        )}
                        {k.strokeCount && (
                          <span className="text-[10px] text-zinc-400">
                            {k.strokeCount} strokes
                          </span>
                        )}
                        {k.grade && (
                          <span className="text-[10px] text-zinc-400">
                            Grade {k.grade}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 pt-1">No KANJIDIC data yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Example sentences ── */}
      {entry.sentences.length > 0 && (
        <Section title="Example sentences">
          <div className="space-y-3">
            {entry.sentences.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl"
              >
                <p className="text-base leading-relaxed text-zinc-800 dark:text-zinc-200">
                  <FuriganaText text={s.japaneseText} />
                </p>
                <p className="text-sm text-zinc-400 mt-1.5">{s.englishTrans}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── SRS progress ── */}
      <Section title="Study progress">
        {entry.blacklisted ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">Marked as already known — excluded from reviews.</p>
            <UnblacklistButton vocabId={entry.id} />
          </div>
        ) : entry.progress ? (
          <div className="space-y-4">
            <SRSProgress progress={entry.progress} />
            <BlacklistButton vocabId={entry.id} />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">Not yet added to study deck.</p>
            <div className="flex gap-2">
              <BlacklistButton vocabId={entry.id} />
              <StartStudyButton action={addToStudyDeck.bind(null, entry.id)} />
            </div>
          </div>
        )}
      </Section>

      {/* ── Prev / Next navigation ── */}
      <div className="flex justify-between mt-6 text-sm">
        {prevEntry ? (
          <Link
            href={`/vocab/${prevEntry.id}`}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            ← {prevEntry.kanji ?? prevEntry.kana}
          </Link>
        ) : (
          <span />
        )}
        {nextEntry && (
          <Link
            href={`/vocab/${nextEntry.id}`}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            {nextEntry.kanji ?? nextEntry.kana} →
          </Link>
        )}
      </div>

      {/* ── AI Tutor ── (client component, floats) */}
      <TutorDrawer vocabContext={vocabContext} />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 mb-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

function MeaningRow({ index, text }: { index: number; text: string }) {
  // Split POS prefix from the sense text: "(noun) youth; adolescence"
  const match = text.match(/^\(([^)]+)\)\s*/);
  const pos = match ? match[1] : null;
  const content = pos ? text.slice(match![0].length) : text;

  return (
    <li className="flex gap-3 items-baseline">
      <span className="text-zinc-300 dark:text-zinc-600 font-mono text-sm w-5 shrink-0 text-right">
        {index}.
      </span>
      <div>
        {pos && (
          <span className="text-[11px] font-semibold text-indigo-500 dark:text-indigo-400 mr-2 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
            {formatPOS(pos)}
          </span>
        )}
        <span className="text-zinc-700 dark:text-zinc-200 text-sm">{content}</span>
      </div>
    </li>
  );
}

function SRSProgress({
  progress,
}: {
  progress: {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReviewDate: Date;
    totalReviews: number;
  };
}) {
  const now = new Date();
  const isDue = progress.nextReviewDate <= now;
  const daysUntil = Math.round(
    (progress.nextReviewDate.getTime() - now.getTime()) / 86_400_000
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Stat
        label="Next review"
        value={isDue ? "Due now!" : daysUntil === 0 ? "Today" : `${daysUntil}d`}
        highlight={isDue}
      />
      <Stat label="Interval" value={`${progress.interval}d`} />
      <Stat label="Ease" value={progress.easeFactor.toFixed(1)} />
      <Stat label="Reviews" value={String(progress.totalReviews)} />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-center">
      <p
        className={`text-lg font-bold ${
          highlight
            ? "text-red-500"
            : "text-zinc-800 dark:text-zinc-100"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
    </div>
  );
}

// StartStudyButton is defined in ./StartStudyButton.tsx (client component for useFormStatus)

function BlacklistButton({ vocabId }: { vocabId: number }) {
  return (
    <form action={blacklistWord.bind(null, vocabId)}>
      <button
        type="submit"
        className="px-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-red-300 hover:text-red-500 transition-colors font-medium"
      >
        I already know this
      </button>
    </form>
  );
}

function UnblacklistButton({ vocabId }: { vocabId: number }) {
  return (
    <form action={unblacklistWord.bind(null, vocabId)}>
      <button
        type="submit"
        className="px-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-indigo-500 hover:border-indigo-300 transition-colors font-medium"
      >
        Add to study queue
      </button>
    </form>
  );
}

