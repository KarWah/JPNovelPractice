import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET;
  const token = req.cookies.get("admin_token")?.value;
  const isAdmin = !!secret && token === secret;

  if (!isAdmin) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/novels/new"],
};
