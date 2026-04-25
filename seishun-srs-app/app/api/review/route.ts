import { NextRequest } from "next/server";
import { calculateNextReview, type Grade } from "@/lib/srs";
import { getReviewQueue } from "@/lib/repositories/vocab";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/review?novelId=1&count=20
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const novelId = parseInt(searchParams.get("novelId") ?? "1");
  const count   = Math.min(Math.max(parseInt(searchParams.get("count") ?? "20"), 1), 200);

  const queue = await getReviewQueue(novelId, count, user.id);
  return Response.json(queue);
}

// POST /api/review — submit a grade for a card
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { vocabId, grade } = body as { vocabId: number; grade: Grade };

  if (!vocabId || ![1, 2, 3, 4].includes(grade)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const existing = await prisma.userProgress.findUnique({
    where: { userId_vocabId: { userId: user.id, vocabId } },
  });

  const currentState = existing ?? {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date(),
  };

  const next = calculateNextReview(currentState, grade);

  const [progress] = await Promise.all([
    prisma.userProgress.upsert({
      where: { userId_vocabId: { userId: user.id, vocabId } },
      create:  { userId: user.id, vocabId, ...next, lastReviewDate: new Date(), totalReviews: 1 },
      update:  { ...next, lastReviewDate: new Date(), totalReviews: { increment: 1 } },
    }),
    prisma.reviewLog.create({ data: { userId: user.id, vocabId, grade } }),
  ]);

  return Response.json({ progress });
}
