import { NextRequest, NextResponse } from "next/server";
import { getKanjiVGData } from "@/lib/kanjivg";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ char: string }> }
) {
  const { char } = await params;
  if (!char) {
    return NextResponse.json({ error: "Character parameter is required" }, { status: 400 });
  }

  const decoded = decodeURIComponent(char);
  const character = decoded.charAt(0);

  // 1. Fetch KanjiVG SVG parsed data
  const kanjiVG = await getKanjiVGData(character);
  if (!kanjiVG) {
    return NextResponse.json({ error: `No stroke data found for '${character}'` }, { status: 404 });
  }

  // 2. Fetch KANJIDIC dictionary data if available
  let dictionary = null;
  try {
    const entry = await prisma.kanjiEntry.findUnique({
      where: { character },
    });
    if (entry) {
      dictionary = {
        onyomi: entry.onyomi,
        kunyomi: entry.kunyomi,
        meanings: entry.meanings,
        jlptLevel: entry.jlptLevel,
        grade: entry.grade,
        frequency: entry.frequency,
      };
    }
  } catch {
    // Ignore DB error and still return stroke data
  }

  return NextResponse.json(
    {
      character: kanjiVG.character,
      hexCode: kanjiVG.hexCode,
      strokeCount: kanjiVG.strokeCount,
      strokes: kanjiVG.strokes,
      components: kanjiVG.components,
      dictionary,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
