import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, makeSessionCookie } from "@/lib/auth";
import { Role } from "@prisma/client";

// POST /api/auth/setup — one-time admin creation + data migration.
// Locked once any user exists.
export async function POST(req: NextRequest) {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return Response.json({ error: "Setup already complete" }, { status: 403 });
  }

  const { email, password } = await req.json();
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: { email: email.toLowerCase().trim(), passwordHash, role: Role.ADMIN },
  });

  // Claim all existing progress/logs that have no owner yet
  await Promise.all([
    prisma.userProgress.updateMany({ where: { userId: null }, data: { userId: admin.id } }),
    prisma.reviewLog.updateMany({ where: { userId: null }, data: { userId: admin.id } }),
  ]);

  const token = await createSession(admin.id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": makeSessionCookie(token),
    },
  });
}

// GET — lets the client check whether setup is still needed
export async function GET() {
  const userCount = await prisma.user.count();
  return Response.json({ needed: userCount === 0 });
}
