import { NextRequest } from "next/server";
import { blacklist } from "@/lib/services/blacklist";

// POST /api/blacklist — mark a word as blacklisted (skip in review queue)
// Body: { vocabId: number }
export async function POST(req: NextRequest) {
  const { vocabId } = await req.json();
  if (!vocabId || typeof vocabId !== "number") {
    return Response.json({ error: "vocabId is required" }, { status: 400 });
  }
  await blacklist(vocabId);
  return Response.json({ ok: true });
}
