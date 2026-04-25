"use client";

import { useRouter } from "next/navigation";

interface Props {
  email: string;
  isAdmin: boolean;
}

export default function AdminBar({ email, isAdmin }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1.5 text-white text-xs ${isAdmin ? "bg-indigo-600" : "bg-zinc-700"}`}>
      <div className="flex items-center gap-2">
        {isAdmin && <span className="font-semibold">Admin</span>}
        <span className="opacity-75">{email}</span>
      </div>
      <button
        onClick={logout}
        className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors font-medium"
      >
        Log out
      </button>
    </div>
  );
}
