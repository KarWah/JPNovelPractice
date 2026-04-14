import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vocabId = parseInt(id);

  if (isNaN(vocabId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const entry = await prisma.vocabEntry.findUnique({
    where: { id: vocabId },
    select: {
      kanji: true,
      kana: true,
      meaning: true,
      partsOfSpeech: true,
      allReadings: true,
    },
  });

  if (!entry) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    word: entry.kanji ?? entry.kana,
    reading: entry.allReadings[0] ?? entry.kana,
    meaning: entry.meaning,
    partsOfSpeech: entry.partsOfSpeech,
  });
}