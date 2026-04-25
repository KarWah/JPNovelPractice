"use client";

import { useRouter } from "next/navigation";

export default function AdminBar() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1.5 bg-indigo-600 text-white text-xs">
      <span className="font-semibold">Admin mode</span>
      <button
        onClick={logout}
        className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors font-medium"
      >
        Log out
      </button>
    </div>
  );
}
