"use client";

import { useState, useEffect } from "react";
import KanjiStrokeViewer from "./KanjiStrokeViewer";
import KanjiRadicalBreakdown from "./KanjiRadicalBreakdown";
import { fetchKanjiData, getCachedKanji, prefetchKanji, type KanjiResponse } from "@/lib/kanjiClient";

interface KanjiVisualizerProps {
  kanjiChars: string[];
  compact?: boolean;
  initialData?: KanjiResponse | null;
}

export default function KanjiVisualizer({
  kanjiChars,
  compact = false,
  initialData = null,
}: KanjiVisualizerProps) {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const currentChar = kanjiChars[activeIdx] ?? kanjiChars[0];

  // Initialize dataMap from initialData or clientCache
  const [dataMap, setDataMap] = useState<Record<string, KanjiResponse>>(() => {
    const map: Record<string, KanjiResponse> = {};
    if (initialData) {
      map[initialData.character] = initialData;
    }
    for (const char of kanjiChars) {
      const cached = getCachedKanji(char);
      if (cached) {
        map[char] = cached;
      }
    }
    return map;
  });

  const [loading, setLoading] = useState<boolean>(() => {
    return !currentChar || (!dataMap[currentChar] && !getCachedKanji(currentChar));
  });
  const [error, setError] = useState<string | null>(null);
  const [hoveredIndices, setHoveredIndices] = useState<number[]>([]);

  // Prefetch other characters in compound words in the background
  useEffect(() => {
    if (kanjiChars.length > 1) {
      prefetchKanji(kanjiChars);
    }
  }, [kanjiChars]);

  useEffect(() => {
    if (!currentChar) return;

    // Check if already in state or clientCache
    const existing = dataMap[currentChar] || getCachedKanji(currentChar);
    if (existing) {
      setDataMap((prev) => (prev[currentChar] ? prev : { ...prev, [currentChar]: existing }));
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setHoveredIndices([]);

    fetchKanjiData(currentChar)
      .then((data) => {
        if (isMounted) {
          setDataMap((prev) => ({ ...prev, [currentChar]: data }));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentChar, dataMap]);

  if (!currentChar || kanjiChars.length === 0) {
    return null;
  }

  const currentData = dataMap[currentChar] || getCachedKanji(currentChar);

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Tab bar for multi-kanji words */}
      {kanjiChars.length > 1 && (
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto">
          <span className="text-xs text-zinc-400 font-medium mr-1 shrink-0">Characters:</span>
          {kanjiChars.map((char, idx) => {
            const isActive = idx === activeIdx;
            const charData = dataMap[char] || getCachedKanji(char);
            return (
              <button
                key={char}
                onClick={() => {
                  setActiveIdx(idx);
                  setHoveredIndices([]);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold text-base flex items-center gap-1.5 transition-all shrink-0 ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                <span>{char}</span>
                {charData && (
                  <span
                    className={`text-[10px] font-normal font-sans ${
                      isActive ? "text-indigo-200" : "text-zinc-400"
                    }`}
                  >
                    {charData.strokeCount}st
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      {loading && !currentData ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2.5">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-zinc-400">Loading stroke order & radicals...</p>
        </div>
      ) : error && !currentData ? (
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-center text-xs text-zinc-400">
          {error || "No stroke data available for this character."}
        </div>
      ) : currentData ? (
        <div
          className={`flex flex-col ${
            compact ? "gap-6" : "md:flex-row gap-8 items-start"
          }`}
        >
          {/* Left / Top: Stroke Order Animator */}
          <div className={`shrink-0 ${compact ? "w-full flex justify-center" : "w-full md:w-auto flex justify-center"}`}>
            <KanjiStrokeViewer
              character={currentData.character}
              strokes={currentData.strokes}
              highlightedIndices={hoveredIndices}
              compact={compact}
            />
          </div>

          {/* Right / Bottom: Radical & Components Breakdown */}
          <div className="flex-1 w-full min-w-0">
            <KanjiRadicalBreakdown
              character={currentData.character}
              components={currentData.components}
              dictionary={currentData.dictionary}
              hoveredIndices={hoveredIndices}
              onHoverIndices={setHoveredIndices}
              compact={compact}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
