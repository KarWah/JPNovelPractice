import * as fs from "fs";
import * as path from "path";
import { getRadicalInfo } from "./radicals";

export interface StrokeData {
  id: string;
  type: string;
  d: string;
  number?: {
    num: number;
    x: number;
    y: number;
  };
}

export interface ComponentData {
  element: string;
  position?: string;
  isRadical: boolean;
  radicalName?: string;
  radicalMeaning?: string;
  strokeIndices: number[]; // 0-based indices into strokes array
}

export interface KanjiVGData {
  character: string;
  hexCode: string;
  strokeCount: number;
  strokes: StrokeData[];
  components: ComponentData[];
}

// In-memory cache for parsed kanji data
const memoryCache = new Map<string, KanjiVGData>();

/**
 * Convert a kanji character to KanjiVG 5-digit hex code (e.g. '青' -> '09752')
 */
export function charToHex(char: string): string {
  const code = char.codePointAt(0);
  if (!code) return "";
  return code.toString(16).padStart(5, "0").toLowerCase();
}

/**
 * Fetch and parse KanjiVG SVG for a character
 */
export async function getKanjiVGData(character: string): Promise<KanjiVGData | null> {
  if (!character) return null;
  const char = character.charAt(0);
  if (memoryCache.has(char)) {
    return memoryCache.get(char)!;
  }

  const hex = charToHex(char);
  if (!hex) return null;

  let svgText: string | null = null;

  // 1. Check local cache directory
  const cacheDir = path.join(process.cwd(), "..", "scripts", ".cache", "kanji-svg");
  const localCacheFile = path.join(cacheDir, `${hex}.svg`);

  try {
    if (fs.existsSync(localCacheFile)) {
      svgText = fs.readFileSync(localCacheFile, "utf-8");
    }
  } catch {
    // Ignore read errors
  }

  // 2. Fetch from CDN if not cached
  if (!svgText) {
    const urls = [
      `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg/kanji/${hex}.svg`,
      `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`,
    ];

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          svgText = await res.text();
          // Write to local cache asynchronously
          try {
            if (!fs.existsSync(cacheDir)) {
              fs.mkdirSync(cacheDir, { recursive: true });
            }
            fs.writeFileSync(localCacheFile, svgText, "utf-8");
          } catch {
            // Ignore cache write error
          }
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!svgText) {
    return null;
  }

  const parsed = parseKanjiVGSVG(char, hex, svgText);
  if (parsed) {
    memoryCache.set(char, parsed);
  }
  return parsed;
}

/**
 * Parse KanjiVG SVG string into structured strokes and components
 */
function parseKanjiVGSVG(character: string, hexCode: string, svg: string): KanjiVGData | null {
  // 1. Parse strokes (<path ...>)
  const pathRegex = /<path\s+[^>]*>/g;
  const strokes: StrokeData[] = [];
  const strokeIdToIndex = new Map<string, number>();

  let m: RegExpExecArray | null;
  while ((m = pathRegex.exec(svg)) !== null) {
    const tag = m[0];
    const id = (tag.match(/\bid="([^"]+)"/) || [])[1] || "";
    const type = (tag.match(/\bkvg:type="([^"]+)"/) || [])[1] || "";
    const d = (tag.match(/\bd="([^"]+)"/) || [])[1] || "";

    if (d) {
      const index = strokes.length;
      strokes.push({ id, type, d });
      if (id) {
        strokeIdToIndex.set(id, index);
      }
    }
  }

  if (strokes.length === 0) {
    return null;
  }

  // 2. Parse stroke numbers (<text transform="matrix(... x y)">num</text>)
  const textRegex = /<text[^>]+transform="matrix\([^)]+\s+([0-9\.]+)\s+([0-9\.]+)\)"[^>]*>(\d+)<\/text>/g;
  while ((m = textRegex.exec(svg)) !== null) {
    const x = parseFloat(m[1]);
    const y = parseFloat(m[2]);
    const num = parseInt(m[3], 10);
    const strokeIndex = num - 1;
    if (strokeIndex >= 0 && strokeIndex < strokes.length) {
      strokes[strokeIndex].number = { num, x, y };
    }
  }

  // 3. Parse component hierarchy (<g kvg:element="...">)
  // We scan the SVG XML for groups that specify kvg:element
  const components: ComponentData[] = [];
  const groupRegex = /<g\s+([^>]*kvg:element="([^"]+)"[^>]*)>([\s\S]*?)<\/g>/g;

  // A more robust approach: Find all <g> tags with kvg:element and their nested paths
  // Since XML can be nested, we can find elements by scanning tags with balanced stacks or regex
  const elementGroups = extractElementGroups(svg);

  for (const eg of elementGroups) {
    // Map stroke IDs to indices
    const indices: number[] = [];
    for (const sid of eg.strokeIds) {
      const idx = strokeIdToIndex.get(sid);
      if (idx !== undefined && !indices.includes(idx)) {
        indices.push(idx);
      }
    }
    indices.sort((a, b) => a - b);

    // Look up radical info
    const radInfo = getRadicalInfo(eg.element);

    components.push({
      element: eg.element,
      position: eg.position,
      isRadical: eg.isRadical,
      radicalName: radInfo?.name,
      radicalMeaning: radInfo?.meaning,
      strokeIndices: indices,
    });
  }

  // Deduplicate and filter out root character itself if it just encompasses all strokes
  const filteredComponents = components.filter((c, i, arr) => {
    // If it's the exact same character as the root and contains all strokes, keep only if marked radical
    if (c.element === character && c.strokeIndices.length === strokes.length && !c.isRadical) {
      return false;
    }
    // Remove duplicates with identical element and strokeIndices
    return arr.findIndex((other) => other.element === c.element && other.strokeIndices.join(",") === c.strokeIndices.join(",")) === i;
  });

  return {
    character,
    hexCode,
    strokeCount: strokes.length,
    strokes,
    components: filteredComponents,
  };
}

interface RawGroup {
  element: string;
  position?: string;
  isRadical: boolean;
  strokeIds: string[];
}

/**
 * Scan SVG for kvg:element groups and collect their path stroke IDs
 */
function extractElementGroups(svg: string): RawGroup[] {
  const groups: RawGroup[] = [];

  // Find all <g ...> open tags that have kvg:element
  const gTagRegex = /<g\s+([^>]*kvg:element="([^"]+)"[^>]*)>/g;
  let match: RegExpExecArray | null;

  while ((match = gTagRegex.exec(svg)) !== null) {
    const attrs = match[1];
    const element = match[2];
    const startIdx = match.index + match[0].length;

    const position = (attrs.match(/\bkvg:position="([^"]+)"/) || [])[1];
    const radicalAttr = (attrs.match(/\bkvg:radical="([^"]+)"/) || [])[1];
    const isRadical = Boolean(radicalAttr);

    // Find the matching closing </g> for this group
    let depth = 1;
    let endIdx = startIdx;
    const tagScan = /<\/?g\b[^>]*>/g;
    tagScan.lastIndex = startIdx;

    let subTag: RegExpExecArray | null;
    while ((subTag = tagScan.exec(svg)) !== null) {
      if (subTag[0].startsWith("</g")) {
        depth--;
        if (depth === 0) {
          endIdx = subTag.index;
          break;
        }
      } else {
        depth++;
      }
    }

    const groupBody = svg.slice(startIdx, endIdx);

    // Extract all path IDs within this group
    const strokeIds: string[] = [];
    const pathIdRegex = /<path\s+[^>]*\bid="([^"]+)"[^>]*>/g;
    let pm: RegExpExecArray | null;
    while ((pm = pathIdRegex.exec(groupBody)) !== null) {
      strokeIds.push(pm[1]);
    }

    if (strokeIds.length > 0) {
      groups.push({
        element,
        position,
        isRadical,
        strokeIds,
      });
    }
  }

  return groups;
}
