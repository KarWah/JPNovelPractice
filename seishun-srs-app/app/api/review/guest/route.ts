import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/review/guest?novelId=1&count=20&knownIds=1,2,3
// No auth required — returns vocab cards for guest study sessions.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const novelId = parseInt(searchParams.get("novelId") ?? "1");
  const count = Math.min(Math.max(parseInt(searchParams.get("count") ?? "20"), 1), 200);

  // Parse comma-separated known IDs from client localStorage
  const knownParam = searchParams.get("knownIds") ?? "";
  const knownIds = knownParam
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));

  const words = await prisma.vocabEntry.findMany({
    where: {
      novelId,
      blacklisted: false,
      ...(knownIds.length > 0 ? { id: { notIn: knownIds } } : {}),
    },
    orderBy: { occurrences: "desc" },
    take: count,
    include: { sentences: true },
  });

  return Response.json({ words });
}
