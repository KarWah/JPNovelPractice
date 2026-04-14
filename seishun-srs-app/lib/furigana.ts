// Parses bracket notation: [漢字](かんじ) → { kanji, kana } pairs
// Plain text passes through as-is.

export interface FuriganaToken {
  type: "ruby" | "text";
  text: string;
  reading?: string; // only for type === "ruby"
}

const RUBY_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export function parseFurigana(input: string): FuriganaToken[] {
  const tokens: FuriganaToken[] = [];
  let lastIndex = 0;

  for (const match of input.matchAll(RUBY_PATTERN)) {
    const [full, kanji, reading] = match;
    const start = match.index!;

    if (start > lastIndex) {
      tokens.push({ type: "text", text: input.slice(lastIndex, start) });
    }

    tokens.push({ type: "ruby", text: kanji, reading });
    lastIndex = start + full.length;
  }

  if (lastIndex < input.length) {
    tokens.push({ type: "text", text: input.slice(lastIndex) });
  }

  return tokens;
}

// Strip furigana markup to plain text (for search / display without ruby)
export function stripFurigana(input: string): string {
  return input.replace(RUBY_PATTERN, "$1");
}
