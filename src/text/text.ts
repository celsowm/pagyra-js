/* The UNICODE_TO_WIN_ANSI map is defined in pdf/utils/encoding.ts */
import { UNICODE_TO_WIN_ANSI } from "../pdf/utils/encoding.js";

export function needsUnicode(text: string): boolean {
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0)!;
    if (!UNICODE_TO_WIN_ANSI.has(cp)) return true; // ✓ ★, combining, etc.
  }
  return false;
}

// Extend Intl type for Segmenter
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Intl {
    class Segmenter {
      constructor(locales?: string | string[], options?: Record<string, unknown>);
      segment(input: string): Iterable<{ segment: string }>;
    }
  }
}

export function normalizeAndSegment(text: string): string[] {
  const normalized = text.normalize("NFC");
  // Fallback for environments without Intl.Segmenter
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter("pt", { granularity: "grapheme" });
    return [...seg.segment(normalized)].map(s => s.segment);
  } else {
    // Simple grapheme splitting by character (not perfect but better than nothing)
    return Array.from(normalized);
  }
}
