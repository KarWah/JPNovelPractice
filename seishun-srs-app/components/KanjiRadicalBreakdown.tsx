"use client";

import type { ComponentData } from "@/lib/kanjivg";

interface KanjiRadicalBreakdownProps {
  character: string;
  components: ComponentData[];
  dictionary?: {
    onyomi: string[];
    kunyomi: string[];
    meanings: string[];
    jlptLevel?: string | null;
    grade?: number | null;
    frequency?: number | null;
  } | null;
  hoveredIndices: number[];
  onHoverIndices: (indices: number[]) => void;
  compact?: boolean;
}

const POSITION_LABELS: Record<string, string> = {
  left: "Left (へん)",
  right: "Right (づくり)",
  top: "Top (かんむり)",
  bottom: "Bottom (あし)",
  tare: "Hanging (たれ)",
  nyo: "Surrounding (にょう)",
  kamae: "Enclosure (かまえ)",
};

export default function KanjiRadicalBreakdown({
  character,
  components,
  dictionary,
  hoveredIndices,
  onHoverIndices,
  compact = false,
}: KanjiRadicalBreakdownProps) {
  // Identify main radical
  const mainRadical = components.find((c) => c.isRadical) || components[0];

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Dictionary Quick Info (Readings & Meanings) */}
      {dictionary && (
        <div className="space-y-2">
          {/* Meanings */}
          {dictionary.meanings.length > 0 && (
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {dictionary.meanings.join(", ")}
            </p>
          )}

          {/* Readings */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {dictionary.onyomi.map((r) => (
              <span
                key={`on-${r}`}
                className="px-2 py-0.5 rounded-md font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50"
              >
                {r}
              </span>
            ))}
            {dictionary.kunyomi.map((r) => (
              <span
                key={`kun-${r}`}
                className="px-2 py-0.5 rounded-md font-medium text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/50"
              >
                {r}
              </span>
            ))}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 pt-0.5">
            {dictionary.jlptLevel && (
              <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 font-medium">
                {dictionary.jlptLevel}
              </span>
            )}
            {dictionary.grade && (
              <span className="text-zinc-400">Grade {dictionary.grade}</span>
            )}
            {dictionary.frequency && (
              <span className="text-zinc-400">#{dictionary.frequency} in frequency</span>
            )}
          </div>
        </div>
      )}

      {/* Radical & Components Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Radicals & Components
          </p>
          <span className="text-[11px] text-zinc-400">Hover part to highlight</span>
        </div>

        {components.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">Single primitive character (no decomposition).</p>
        ) : (
          <div className="space-y-2">
            {components.map((comp, idx) => {
              const isHovered =
                hoveredIndices.length > 0 &&
                comp.strokeIndices.every((i) => hoveredIndices.includes(i)) &&
                hoveredIndices.every((i) => comp.strokeIndices.includes(i));

              const strokeRange =
                comp.strokeIndices.length === 1
                  ? `Stroke ${comp.strokeIndices[0] + 1}`
                  : `Strokes ${comp.strokeIndices[0] + 1}–${
                      comp.strokeIndices[comp.strokeIndices.length - 1] + 1
                    }`;

              return (
                <div
                  key={`${comp.element}-${idx}`}
                  onMouseEnter={() => onHoverIndices(comp.strokeIndices)}
                  onMouseLeave={() => onHoverIndices([])}
                  onClick={() =>
                    onHoverIndices(isHovered ? [] : comp.strokeIndices)
                  }
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isHovered
                      ? "border-indigo-400 bg-indigo-50/70 dark:border-indigo-600 dark:bg-indigo-950/40 shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 w-8 text-center">
                      {comp.element}
                    </span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        {comp.isRadical && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                            Radical (部首)
                          </span>
                        )}
                        {comp.position && POSITION_LABELS[comp.position] && (
                          <span className="text-[10px] text-zinc-400">
                            {POSITION_LABELS[comp.position]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        {comp.radicalName && (
                          <span className="font-medium mr-1.5">{comp.radicalName}</span>
                        )}
                        {comp.radicalMeaning && (
                          <span className="text-zinc-500 dark:text-zinc-400">
                            “{comp.radicalMeaning}”
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono text-zinc-400">
                      {strokeRange}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
