"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { speakJapanese } from "@/lib/speech";

interface AudioButtonProps {
  text: string;
  size?: "sm" | "md" | "lg";
  voice?: string;
  label?: string;
  className?: string;
}

// Global reference to ensure only one audio plays at a time
let currentActiveAudio: HTMLAudioElement | null = null;
let stopCurrentCallback: (() => void) | null = null;

export default function AudioButton({
  text,
  size = "md",
  voice = "ja-JP-NanamiNeural",
  label,
  className = "",
}: AudioButtonProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop playback when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // Avoid triggering parent clicks (e.g. flashcard flip)

      // If this button is already playing, stop it
      if (isPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        setIsPlaying(false);
        currentActiveAudio = null;
        stopCurrentCallback = null;
        return;
      }

      // Stop any other currently playing audio
      if (stopCurrentCallback) {
        stopCurrentCallback();
      }

      setIsPlaying(true);

      const audioUrl = `/api/audio?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      currentActiveAudio = audio;
      stopCurrentCallback = () => {
        audio.pause();
        setIsPlaying(false);
      };

      audio.onended = () => {
        setIsPlaying(false);
        if (currentActiveAudio === audio) {
          currentActiveAudio = null;
          stopCurrentCallback = null;
        }
      };

      audio.onerror = () => {
        // Fallback to browser speech synthesis if the audio endpoint fails
        console.warn("Neural audio endpoint failed, falling back to browser speech synthesis.");
        speakJapanese(text, {
          onEnd: () => setIsPlaying(false),
          onError: () => setIsPlaying(false),
        });
      };

      audio.play().catch((err) => {
        // Browser autoplay policy or playback error
        console.warn("Audio play prevented or failed:", err);
        setIsPlaying(false);
      });
    },
    [text, voice, isPlaying]
  );

  const sizeClasses = {
    sm: "w-7 h-7 p-1 text-xs",
    md: "w-8 h-8 p-1.5 text-sm",
    lg: "w-10 h-10 p-2 text-base",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      type="button"
      onClick={handlePlay}
      title={label || `Listen (Neural): ${text}`}
      className={`inline-flex items-center justify-center rounded-full transition-all shrink-0 ${
        sizeClasses[size]
      } ${
        isPlaying
          ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300 ring-2 ring-indigo-400 scale-105"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
      } ${className}`}
      aria-label={label || "Pronounce"}
    >
      <svg
        className={`${iconSizes[size]} ${isPlaying ? "animate-pulse" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Speaker base */}
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        {/* Sound waves */}
        <path
          d="M15.54 8.46a5 5 0 0 1 0 7.07"
          className={isPlaying ? "stroke-indigo-600 dark:stroke-indigo-400" : ""}
        />
        {size !== "sm" && (
          <path
            d="M19.07 4.93a10 10 0 0 1 0 14.14"
            className={isPlaying ? "stroke-indigo-600 dark:stroke-indigo-400" : ""}
          />
        )}
      </svg>
    </button>
  );
}
