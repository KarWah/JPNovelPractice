"use client";

import { parseFurigana } from "@/lib/furigana";

interface FuriganaTextProps {
  text: string;
  className?: string;
}

export default function FuriganaText({ text, className }: FuriganaTextProps) {
  const tokens = parseFurigana(text);

  return (
    <span className={className}>
      {tokens.map((token, i) =>
        token.type === "ruby" ? (
          <ruby key={i}>
            {token.text}
            <rt className="text-xs text-zinc-500">{token.reading}</rt>
          </ruby>
        ) : (
          <span key={i}>{token.text}</span>
        )
      )}
    </span>
  );
}
