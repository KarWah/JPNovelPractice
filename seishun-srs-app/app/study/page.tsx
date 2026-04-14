import { Suspense } from "react";
import StudySession from "./StudySession";

export default function StudyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-zinc-400">Loading session...</p>
        </div>
      }
    >
      <StudySession />
    </Suspense>
  );
}
