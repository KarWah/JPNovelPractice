import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/vocab?limit=20&offset=0&search=...
// Returns vocab sorted by frequency, with SRS progress attached.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const search = searchParams.get("search") ?? "";

  const where = search
    ? {
        OR: [
          { kanji: { contains: search } },
          { kana: { contains: search } },
          { meaning: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [entries, total] = await Promise.all([
    prisma.vocabEntry.findMany({
      where,
      orderBy: { occurrences: "desc" },
      take: limit,
      skip: offset,
      include: { progress: true, sentences: true },
    }),
    prisma.vocabEntry.count({ where }),
  ]);

  return Response.json({ entries, total, limit, offset });
}
