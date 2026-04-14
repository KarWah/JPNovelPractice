interface StatCardProps {
  label: string;
  value: number | string;
  accent?: "indigo" | "yellow" | "green";
  sub?: string;
}

export default function StatCard({ label, value, accent, sub }: StatCardProps) {
  const accentClass =
    accent === "indigo"
      ? "text-indigo-600 dark:text-indigo-400"
      : accent === "yellow"
      ? "text-yellow-600 dark:text-yellow-400"
      : accent === "green"
      ? "text-green-600 dark:text-green-400"
      : "text-zinc-800 dark:text-zinc-100";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-700">
      <p className={`text-3xl font-bold ${accentClass}`}>{value}</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{label}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}
