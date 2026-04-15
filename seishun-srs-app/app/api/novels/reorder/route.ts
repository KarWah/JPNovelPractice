import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/novels/reorder
// Body: { id: number; sortOrder: number }[]
export async function POST(req: NextRequest) {
  const updates: { id: number; sortOrder: number }[] = await req.json();

  if (!Array.isArray(updates) || updates.some((u) => typeof u.id !== "number" || typeof u.sortOrder !== "number")) {
    return Response.json({ error: "Expected array of { id, sortOrder }" }, { status: 400 });
  }

  await Promise.all(
    updates.map(({ id, sortOrder }) =>
      prisma.novel.update({ where: { id }, data: { sortOrder } })
    )
  );

  return Response.json({ ok: true });
}
