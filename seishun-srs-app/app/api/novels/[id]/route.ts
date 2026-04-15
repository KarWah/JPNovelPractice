import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/novels/[id]
// Body: { title: string }
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const novelId = parseInt(id);

  if (isNaN(novelId)) {
    return Response.json({ error: "Invalid novel id" }, { status: 400 });
  }

  const { title } = await req.json() as { title?: string };
  if (!title || !title.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const novel = await prisma.novel.update({
    where: { id: novelId },
    data: { title: title.trim() },
    select: { id: true, title: true },
  });

  return Response.json({ ok: true, novel });
}

// DELETE /api/novels/[id]
// Removes a novel and all associated vocab, progress, review logs, and example sentences.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const novelId = parseInt(id);

  if (isNaN(novelId)) {
    return Response.json({ error: "Invalid novel id" }, { status: 400 });
  }

  const novel = await prisma.novel.findUnique({ where: { id: novelId } });
  if (!novel) {
    return Response.json({ error: "Novel not found" }, { status: 404 });
  }

  // Collect all vocab IDs for this novel (needed to cascade manually)
  const vocabIds = (
    await prisma.vocabEntry.findMany({
      where: { novelId },
      select: { id: true },
    })
  ).map((v) => v.id);

  if (vocabIds.length > 0) {
    // Delete in FK dependency order
    await prisma.reviewLog.deleteMany({ where: { vocabId: { in: vocabIds } } });
    await prisma.userProgress.deleteMany({ where: { vocabId: { in: vocabIds } } });
    await prisma.exampleSentence.deleteMany({ where: { vocabId: { in: vocabIds } } });
    await prisma.vocabEntry.deleteMany({ where: { novelId } });
  }

  await prisma.novel.delete({ where: { id: novelId } });

  return Response.json({ ok: true });
}
