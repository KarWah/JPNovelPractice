-- AlterTable
ALTER TABLE "VocabEntry" ADD COLUMN     "blacklisted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" SERIAL NOT NULL,
    "vocabId" INTEGER NOT NULL,
    "grade" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_vocabId_fkey" FOREIGN KEY ("vocabId") REFERENCES "VocabEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
