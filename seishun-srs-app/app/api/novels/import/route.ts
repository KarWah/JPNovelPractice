import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { blacklistCrossNovel } from "@/lib/services/blacklist";
import { Role } from "@prisma/client";

interface VocabEntry {
  spelling: string;
  meaning: string;
  occurrences: number;
}

// POST /api/novels/import — multipart/form-data (admin only)
// Fields: vocab (JSON file), title (string), autoBlacklist (boolean string)
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (user?.role !== Role.ADMIN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const title = (formData.get("title") as string | null)?.trim();
  const autoBlacklist = formData.get("autoBlacklist") !== "false";
  const file = formData.get("vocab") as File | null;

  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (!file) {
    return Response.json({ error: "vocab JSON file is required" }, { status: 400 });
  }

  const slug = title.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").slice(0, 60);

  const existing = await prisma.novel.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    return Response.json(
      { error: `A novel with this title already exists (slug "${slug}" is taken).` },
      { status: 409 }
    );
  }

  let vocabList: VocabEntry[];
  try {
    const text = await file.text();
    vocabList = JSON.parse(text);
    if (!Array.isArray(vocabList)) throw new Error("Expected a JSON array");
  } catch (err) {
    return Response.json({ error: `Invalid JSON: ${err}` }, { status: 400 });
  }

  const maxOrder = await prisma.novel.aggregate({ _max: { sortOrder: true } });
  const novel = await prisma.novel.create({
    data: { slug, title, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
  });

  const vocabData = vocabList.map((entry) => {
    const parts = entry.spelling.trim().split(" ");
    const kanji = parts.length > 1 ? parts[0] : null;
    const kana  = parts.length > 1 ? parts[1] : parts[0];
    return { kanji, kana, meaning: entry.meaning, occurrences: entry.occurrences ?? 0, novelId: novel.id };
  });

  await prisma.vocabEntry.createMany({ data: vocabData, skipDuplicates: true });

  if (autoBlacklist) {
    await blacklistCrossNovel(novel.id, user.id);
  }

  return Response.json({ ok: true, novelId: novel.id, count: vocabData.length });
}
