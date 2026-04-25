"use server";

import { prisma } from "@/lib/prisma";
import { blacklist, unblacklist } from "@/lib/services/blacklist";
import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function addToStudyDeck(vocabId: number) {
  const user = await getUser();
  if (!user) return;
  await prisma.userProgress.upsert({
    where: { userId_vocabId: { userId: user.id, vocabId } },
    create: { userId: user.id, vocabId },
    update: {},
  });
  revalidatePath(`/vocab/${vocabId}`);
}

export async function blacklistWord(vocabId: number) {
  if (!(await getUser())) return;
  await blacklist(vocabId);
  revalidatePath(`/vocab/${vocabId}`);
}

export async function unblacklistWord(vocabId: number) {
  if (!(await getUser())) return;
  await unblacklist(vocabId);
  revalidatePath(`/vocab/${vocabId}`);
}
