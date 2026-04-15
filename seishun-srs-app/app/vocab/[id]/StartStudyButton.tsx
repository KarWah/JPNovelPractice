"use client";

import { useFormStatus } from "react-dom";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium disabled:opacity-60"
    >
      {pending ? "Adding…" : "Add to study deck"}
    </button>
  );
}

export function StartStudyButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <SubmitBtn />
    </form>
  );
}
