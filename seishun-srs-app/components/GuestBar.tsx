"use client";

import Link from "next/link";

export default function GuestBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1.5 text-white text-xs bg-amber-600">
      <div className="flex items-center gap-2">
        <span className="font-semibold">👋 Guest Mode</span>
        <span className="opacity-75">Progress is saved in this browser only</span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/register"
          className="px-3 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors font-medium"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
