"use client";

import { GRADE_LABELS, GRADE_DESCRIPTIONS, type Grade } from "@/lib/srs";

interface ReviewButtonsProps {
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
}

const GRADE_STYLES: Record<Grade, string> = {
  1: "bg-red-100 hover:bg-red-200 text-red-800 border-red-300",
  2: "bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300",
  3: "bg-green-100 hover:bg-green-200 text-green-800 border-green-300",
  4: "bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300",
};

export default function ReviewButtons({ onGrade, disabled }: ReviewButtonsProps) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full max-w-lg">
      {([1, 2, 3, 4] as Grade[]).map((grade) => (
        <button
          key={grade}
          onClick={() => onGrade(grade)}
          disabled={disabled}
          className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${GRADE_STYLES[grade]}`}
        >
          <span className="text-sm font-bold">{GRADE_LABELS[grade]}</span>
          <span className="text-xs opacity-70 leading-tight text-center">
            {GRADE_DESCRIPTIONS[grade]}
          </span>
        </button>
      ))}
    </div>
  );
}
