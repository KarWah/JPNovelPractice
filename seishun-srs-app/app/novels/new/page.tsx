import { Suspense } from "react";
import NewNovelForm from "./NewNovelForm";

export const dynamic = "force-dynamic";

export default function NewNovelPage() {
  return (
    <Suspense>
      <NewNovelForm />
    </Suspense>
  );
}
