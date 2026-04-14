-- CreateTable
CREATE TABLE "VocabEntry" (
    "id" SERIAL NOT NULL,
    "kanji" TEXT,
    "kana" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "occurrences" INTEGER NOT NULL DEFAULT 0,
    "jmdictId" INTEGER,
    "jlptLevel" TEXT,
    "partsOfSpeech" TEXT[],
    "allReadings" TEXT[],
    "tags" TEXT[],

    CONSTRAINT "VocabEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExampleSentence" (
    "id" SERIAL NOT NULL,
    "japaneseText" TEXT NOT NULL,
    "englishTrans" TEXT NOT NULL,
    "vocabId" INTEGER NOT NULL,

    CONSTRAINT "ExampleSentence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" SERIAL NOT NULL,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewDate" TIMESTAMP(3),
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "vocabId" INTEGER NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_vocabId_key" ON "UserProgress"("vocabId");

-- AddForeignKey
ALTER TABLE "ExampleSentence" ADD CONSTRAINT "ExampleSentence_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "VocabEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "VocabEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
