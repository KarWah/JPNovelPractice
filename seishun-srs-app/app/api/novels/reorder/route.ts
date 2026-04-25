import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/auth";

// POST /api/novels/reorder (admin only)
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updates: { id: number; sortOrder: number }[] = await req.json();

  if (
    !Array.isArray(updates) ||
    updates.some(
      (u) => typeof u.id !== "number" || typeof u.sortOrder !== "number"
    )
  ) {
    return Response.json({ error: "Expected array of { id, sortOrder }" }, { status: 400 });
  }

  await Promise.all(
    updates.map(({ id, sortOrder }) =>
      prisma.novel.update({ where: { id }, data: { sortOrder } })
    )
  );

  return Response.json({ ok: true });
}
