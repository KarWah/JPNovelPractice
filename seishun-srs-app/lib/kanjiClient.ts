import type { StrokeData, ComponentData } from "./kanjivg";

export interface KanjiResponse {
  character: string;
  hexCode: string;
  strokeCount: number;
  strokes: StrokeData[];
  components: ComponentData[];
  dictionary?: {
    onyomi: string[];
    kunyomi: string[];
    meanings: string[];
    jlptLevel?: string | null;
    grade?: number | null;
    frequency?: number | null;
  } | null;
}

// Global client-side memory cache (persists across page navigations & re-renders)
const clientCache = new Map<string, KanjiResponse>();
const activeRequests = new Map<string, Promise<KanjiResponse>>();

/**
 * Fetch kanji data with client-side in-memory caching
 */
export async function fetchKanjiData(char: string): Promise<KanjiResponse> {
  const character = char.charAt(0);
  if (clientCache.has(character)) {
    return clientCache.get(character)!;
  }

  if (activeRequests.has(character)) {
    return activeRequests.get(character)!;
  }

  const promise = fetch(`/api/kanji/${encodeURIComponent(character)}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${character}`);
      return res.json();
    })
    .then((data: KanjiResponse) => {
      clientCache.set(character, data);
      activeRequests.delete(character);
      return data;
    })
    .catch((err) => {
      activeRequests.delete(character);
      throw err;
    });

  activeRequests.set(character, promise);
  return promise;
}

/**
 * Check if a kanji is already cached in memory
 */
export function getCachedKanji(char: string): KanjiResponse | undefined {
  return clientCache.get(char.charAt(0));
}

/**
 * Preload one or more kanji characters in the background
 */
export function prefetchKanji(chars: string[]): void {
  if (typeof window === "undefined") return;
  for (const c of chars) {
    if (!c || clientCache.has(c) || activeRequests.has(c)) continue;
    fetchKanjiData(c).catch(() => {
      // Ignore background prefetch errors
    });
  }
}
