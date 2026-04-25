import { NextRequest } from "next/server";
import { blacklistCrossNovel } from "@/lib/services/blacklist";
import { getUserFromRequest } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (user?.role !== Role.ADMIN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { novelId } = await req.json();
  if (!novelId || typeof novelId !== "number") {
    return Response.json({ error: "novelId is required" }, { status: 400 });
  }
  const count = await blacklistCrossNovel(novelId, user.id);
  return Response.json({ count });
}
