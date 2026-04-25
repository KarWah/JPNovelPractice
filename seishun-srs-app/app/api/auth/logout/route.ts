import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("session_token")?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } }).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}
