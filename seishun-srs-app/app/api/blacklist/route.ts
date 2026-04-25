import { NextRequest } from "next/server";
import { blacklist } from "@/lib/services/blacklist";
import { isAdminRequest } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vocabId } = await req.json();
  if (!vocabId || typeof vocabId !== "number") {
    return Response.json({ error: "vocabId is required" }, { status: 400 });
  }
  await blacklist(vocabId);
  return Response.json({ ok: true });
}
