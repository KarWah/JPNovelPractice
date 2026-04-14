import { NextRequest } from "next/server";
import { blacklistCrossNovel } from "@/lib/services/blacklist";

// POST /api/blacklist/cross-novel
// Body: { novelId: number }
export async function POST(req: NextRequest) {
  const { novelId } = await req.json();
  if (!novelId || typeof novelId !== "number") {
    return Response.json({ error: "novelId is required" }, { status: 400 });
  }
  const count = await blacklistCrossNovel(novelId);
  return Response.json({ count });
}
