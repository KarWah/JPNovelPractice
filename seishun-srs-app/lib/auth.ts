import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { Role } from "@prisma/client";

const SESSION_COOKIE = "session_token";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

// ── Session type ──────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

// ── Server component helpers (use next/headers cookies) ───────────────────────

export async function getUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, role: true } } },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getUser();
  return user?.role === Role.ADMIN;
}

/** @deprecated single DB now; kept for call-site compat */
export async function getDb() {
  return prisma;
}

// ── API route helpers (read cookies from NextRequest) ─────────────────────────

export async function getUserFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, role: true } } },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const user = await getUserFromRequest(req);
  return user?.role === Role.ADMIN;
}

/** @deprecated single DB now; kept for call-site compat */
export function getDbForRequest(_req: NextRequest) {
  return prisma;
}

// ── Cookie builders ───────────────────────────────────────────────────────────

export function makeSessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production";
  return [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ── Session creation helper ───────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  return session.token;
}
