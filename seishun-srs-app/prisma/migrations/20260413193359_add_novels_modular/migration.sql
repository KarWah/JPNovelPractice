-- CreateTable first so we can insert the seed record before FK validation
CREATE TABLE "Novel" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverImage" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Novel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Novel_slug_key" ON "Novel"("slug");

-- Seed the first novel so DEFAULT 1 on VocabEntry is valid
INSERT INTO "Novel" ("id", "slug", "title", "coverImage", "sortOrder")
VALUES (1, 'bunny-girl-senpai-v1', '青春ブタ野郎はバニーガール先輩の夢を見ない', 'assets/bunny_vol_1.webp', 1);

-- Sync the serial sequence so future inserts start from 2
SELECT setval('"Novel_id_seq"', 1);

-- AlterTable: add novelId with DEFAULT 1 (all existing rows get novel 1)
ALTER TABLE "VocabEntry" ADD COLUMN "novelId" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey (FK check passes because novel 1 now exists)
ALTER TABLE "VocabEntry" ADD CONSTRAINT "VocabEntry_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
