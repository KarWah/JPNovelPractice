import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { adminPrisma, demoPrisma } from "./prisma";

const COOKIE = "admin_token";

// ── Server components (async, reads next/headers cookies) ────────────────────

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return store.get(COOKIE)?.value === secret;
}

export async function getDb() {
  return (await isAdmin()) ? adminPrisma : demoPrisma;
}

// ── API route handlers (sync, reads NextRequest cookies) ─────────────────────

export function isAdminRequest(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return req.cookies.get(COOKIE)?.value === secret;
}

export function getDbForRequest(req: NextRequest) {
  return isAdminRequest(req) ? adminPrisma : demoPrisma;
}
