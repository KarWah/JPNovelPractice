"use server";

import { prisma } from "@/lib/prisma";
import { blacklist, unblacklist } from "@/lib/services/blacklist";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addToStudyDeck(vocabId: number) {
  if (!(await isAdmin())) return;
  await prisma.userProgress.upsert({
    where: { vocabId },
    create: { vocabId },
    update: {},
  });
  revalidatePath(`/vocab/${vocabId}`);
}

export async function blacklistWord(vocabId: number) {
  if (!(await isAdmin())) return;
  await blacklist(vocabId);
  revalidatePath(`/vocab/${vocabId}`);
}

export async function unblacklistWord(vocabId: number) {
  if (!(await isAdmin())) return;
  await unblacklist(vocabId);
  revalidatePath(`/vocab/${vocabId}`);
}
