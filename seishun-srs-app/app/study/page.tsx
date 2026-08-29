import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import StudySession from "./StudySession";

export default async function StudyPage() {
  const user = await getUser();

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-zinc-400">Loading session...</p>
        </div>
      }
    >
      <StudySession isGuest={!user} />
    </Suspense>
  );
}
