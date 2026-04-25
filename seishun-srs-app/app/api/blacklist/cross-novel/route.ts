import { NextRequest } from "next/server";
import { blacklistCrossNovel } from "@/lib/services/blacklist";
import { isAdminRequest } from "@/lib/auth";

// POST /api/blacklist/cross-novel (admin only)
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { novelId } = await req.json();
  if (!novelId || typeof novelId !== "number") {
    return Response.json({ error: "novelId is required" }, { status: 400 });
  }
  const count = await blacklistCrossNovel(novelId);
  return Response.json({ count });
}
