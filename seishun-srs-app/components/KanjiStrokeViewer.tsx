"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { StrokeData } from "@/lib/kanjivg";

interface KanjiStrokeViewerProps {
  character: string;
  strokes: StrokeData[];
  highlightedIndices?: number[]; // Strokes to highlight (e.g. from hovering a radical)
  compact?: boolean;
}

export default function KanjiStrokeViewer({
  character,
  strokes,
  highlightedIndices = [],
  compact = false,
}: KanjiStrokeViewerProps) {
  // Current stroke progress: 0 means showing no strokes, strokes.length means fully written
  const [currentStroke, setCurrentStroke] = useState<number>(strokes.length);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showNumbers, setShowNumbers] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1); // 1 = normal (~700ms), 1.5 = fast, 2 = very fast
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset to full view whenever the character changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentStroke(strokes.length);
  }, [character, strokes.length]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Animation step loop
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.round(750 / speed);
      timerRef.current = setInterval(() => {
        setCurrentStroke((prev) => {
          if (prev >= strokes.length) {
            // Reached the end, pause briefly or loop
            return 1;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, strokes.length, speed]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && currentStroke >= strokes.length) {
        // Start from stroke 1 if already at end
        setCurrentStroke(1);
      }
      return !prev;
    });
  }, [currentStroke, strokes.length]);

  const prevStep = useCallback(() => {
    setIsPlaying(false);
    setCurrentStroke((prev) => Math.max(1, prev - 1));
  }, []);

  const nextStep = useCallback(() => {
    setIsPlaying(false);
    setCurrentStroke((prev) => Math.min(strokes.length, prev + 1));
  }, [strokes.length]);

  const resetAll = useCallback(() => {
    setIsPlaying(false);
    setCurrentStroke(strokes.length);
  }, [strokes.length]);

  const startFromBeginning = useCallback(() => {
    setIsPlaying(true);
    setCurrentStroke(1);
  }, []);

  const hasHighlights = highlightedIndices.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Calligraphy Canvas */}
      <div
        className={`relative ${
          compact ? "w-44 h-44" : "w-60 h-60"
        } rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-inner flex items-center justify-center select-none overflow-hidden`}
      >
        <svg
          viewBox="0 0 109 109"
          className="w-full h-full p-2"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Traditional 2x2 Calligraphy Guidelines */}
          <g className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="0.8" strokeDasharray="3 3">
            <line x1="54.5" y1="0" x2="54.5" y2="109" />
            <line x1="0" y1="54.5" x2="109" y2="54.5" />
          </g>

          {/* Faint Background Guide (all strokes outline) */}
          <g
            fill="none"
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {strokes.map((s) => (
              <path key={`bg-${s.id}`} d={s.d} />
            ))}
          </g>

          {/* Visible Active Strokes */}
          <g fill="none" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
            {strokes.slice(0, currentStroke).map((s, idx) => {
              const isHighlighted = highlightedIndices.includes(idx);
              const isCurrent = idx === currentStroke - 1 && isPlaying;

              let strokeColor = "stroke-zinc-900 dark:stroke-zinc-100";

              if (hasHighlights) {
                strokeColor = isHighlighted
                  ? "stroke-indigo-600 dark:stroke-indigo-400"
                  : "stroke-zinc-300 dark:stroke-zinc-700 opacity-40";
              } else if (isCurrent) {
                strokeColor = "stroke-indigo-600 dark:stroke-indigo-400";
              }

              return (
                <path
                  key={`stroke-${s.id}`}
                  d={s.d}
                  className={`transition-colors duration-200 ${strokeColor}`}
                  style={{
                    strokeWidth: isHighlighted ? 4.2 : 3.6,
                  }}
                />
              );
            })}
          </g>

          {/* Stroke Start Numbers */}
          {showNumbers && (
            <g className="select-none font-sans" fontSize="6.5" fontWeight="bold">
              {strokes.slice(0, currentStroke).map((s, idx) => {
                if (!s.number) return null;
                const isHighlighted = highlightedIndices.includes(idx);
                const isCurrent = idx === currentStroke - 1;

                let textColor = "#71717a"; // zinc-500
                if (hasHighlights) {
                  textColor = isHighlighted ? "#4f46e5" : "#a1a1aa";
                } else if (isCurrent) {
                  textColor = "#4f46e5";
                }

                return (
                  <text
                    key={`num-${s.id}`}
                    x={s.number.x}
                    y={s.number.y}
                    fill={textColor}
                    className="transition-colors duration-150"
                  >
                    {s.number.num}
                  </text>
                );
              })}
            </g>
          )}
        </svg>

        {/* Floating stroke indicator badge */}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur border border-zinc-200 dark:border-zinc-800 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
          {currentStroke} / {strokes.length}
        </div>
      </div>

      {/* Progress Dots */}
      <div className="flex gap-1 mt-3 max-w-full flex-wrap justify-center px-2">
        {strokes.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setIsPlaying(false);
              setCurrentStroke(idx + 1);
            }}
            title={`Go to stroke ${idx + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              idx < currentStroke
                ? highlightedIndices.includes(idx)
                  ? "w-4 bg-indigo-500"
                  : "w-3 bg-zinc-800 dark:bg-zinc-200"
                : "w-1.5 bg-zinc-200 dark:bg-zinc-800"
            }`}
          />
        ))}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-2 mt-4">
        {/* Restart */}
        <button
          onClick={startFromBeginning}
          title="Play from start"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>

        {/* Step Prev */}
        <button
          onClick={prevStep}
          disabled={currentStroke <= 1}
          title="Previous stroke"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Play / Pause Primary Button */}
        <button
          onClick={togglePlay}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-colors"
        >
          {isPlaying ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
              <span>Pause</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>{currentStroke >= strokes.length ? "Replay" : "Play"}</span>
            </>
          )}
        </button>

        {/* Step Next */}
        <button
          onClick={nextStep}
          disabled={currentStroke >= strokes.length}
          title="Next stroke"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Show Full Character */}
        <button
          onClick={resetAll}
          title="Show all strokes"
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>

      {/* Options Row (Numbers toggle + Speed) */}
      <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
        <label className="flex items-center gap-1.5 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300">
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={(e) => setShowNumbers(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
          />
          <span>Stroke numbers</span>
        </label>

        <span className="text-zinc-300 dark:text-zinc-700">•</span>

        <button
          onClick={() => setSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))}
          className="hover:text-zinc-800 dark:hover:text-zinc-200 font-mono transition-colors"
          title="Toggle animation speed"
        >
          Speed: {speed}x
        </button>
      </div>
    </div>
  );
}
