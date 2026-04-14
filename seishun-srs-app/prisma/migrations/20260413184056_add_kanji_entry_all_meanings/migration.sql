-- AlterTable
ALTER TABLE "VocabEntry" ADD COLUMN     "allMeanings" TEXT[];

-- CreateTable
CREATE TABLE "KanjiEntry" (
    "character" TEXT NOT NULL,
    "onyomi" TEXT[],
    "kunyomi" TEXT[],
    "meanings" TEXT[],
    "strokeCount" INTEGER,
    "jlptLevel" TEXT,
    "grade" INTEGER,
    "frequency" INTEGER,

    CONSTRAINT "KanjiEntry_pkey" PRIMARY KEY ("character")
);
