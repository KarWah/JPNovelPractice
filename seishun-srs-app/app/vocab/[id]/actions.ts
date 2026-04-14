"use server";

import { prisma } from "@/lib/prisma";
import { blacklist, unblacklist } from "@/lib/services/blacklist";
import { revalidatePath } from "next/cache";

export async function addToStudyDeck(vocabId: number) {
  await prisma.userProgress.upsert({
    where: { vocabId },
    create: { vocabId },
    update: {},
  });
  revalidatePath(`/vocab/${vocabId}`);
}

export async function blacklistWord(vocabId: number) {
  await blacklist(vocabId);
  revalidatePath(`/vocab/${vocabId}`);
}

export async function unblacklistWord(vocabId: number) {
  await unblacklist(vocabId);
  revalidatePath(`/vocab/${vocabId}`);
}
