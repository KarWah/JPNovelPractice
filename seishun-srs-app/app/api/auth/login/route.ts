import { NextRequest } from "next/server";

const COOKIE = "admin_token";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const secret = process.env.ADMIN_SECRET;

  if (!secret || !password || password !== secret) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  const isSecure = process.env.NODE_ENV === "production";
  const cookie = [
    `${COOKIE}=${secret}`,
    "HttpOnly",
    isSecure ? "Secure" : "",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${ONE_YEAR}`,
  ]
    .filter(Boolean)
    .join("; ");

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
