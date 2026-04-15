import { NextRequest } from "next/server";
import { writeFile } from "fs/promises";
import { join, extname } from "path";
import { prisma } from "@/lib/prisma";

const ALLOWED_EXTS = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/novels/[id]/cover — multipart/form-data, field "cover"
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const novelId = parseInt(id);

  if (isNaN(novelId)) {
    return Response.json({ error: "Invalid novel id" }, { status: 400 });
  }

  const novel = await prisma.novel.findUnique({ where: { id: novelId } });
  if (!novel) {
    return Response.json({ error: "Novel not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("cover") as File | null;

  if (!file) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return Response.json({ error: "Only webp/jpg/png files are accepted" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return Response.json({ error: "File exceeds 2 MB limit" }, { status: 400 });
  }

  const filename = `${novel.slug}${ext}`;
  const destPath = join(process.cwd(), "public", "assets", filename);
  await writeFile(destPath, Buffer.from(bytes));

  const coverImage = `assets/${filename}`;
  await prisma.novel.update({
    where: { id: novelId },
    data: { coverImage },
  });

  return Response.json({ ok: true, coverImage });
}
