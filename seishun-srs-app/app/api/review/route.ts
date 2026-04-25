import { NextRequest } from "next/server";
import { calculateNextReview, type Grade } from "@/lib/srs";
import { getReviewQueue } from "@/lib/repositories/vocab";
import { isAdminRequest, getDbForRequest } from "@/lib/auth";

// GET /api/review?novelId=1&count=20
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const novelId = parseInt(searchParams.get("novelId") ?? "1");
  const count   = Math.min(Math.max(parseInt(searchParams.get("count") ?? "20"), 1), 200);

  const db = getDbForRequest(req);
  const queue = await getReviewQueue(novelId, count, db);
  return Response.json(queue);
}

// POST /api/review — submit a grade for a card (admin only)
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { vocabId, grade } = body as { vocabId: number; grade: Grade };

  if (!vocabId || ![1, 2, 3, 4].includes(grade)) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { adminPrisma } = await import("@/lib/prisma");
  const existing = await adminPrisma.userProgress.findUnique({ where: { vocabId } });

  const currentState = existing ?? {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: new Date(),
  };

  const next = calculateNextReview(currentState, grade);

  const [progress] = await Promise.all([
    adminPrisma.userProgress.upsert({
      where: { vocabId },
      create:  { vocabId, ...next, lastReviewDate: new Date(), totalReviews: 1 },
      update:  { ...next, lastReviewDate: new Date(), totalReviews: { increment: 1 } },
    }),
    adminPrisma.reviewLog.create({ data: { vocabId, grade } }),
  ]);

  return Response.json({ progress });
}
