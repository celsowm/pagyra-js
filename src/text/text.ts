/* The UNICODE_TO_WIN_ANSI map is defined in pdf/utils/encoding.ts */
import { UNICODE_TO_WIN_ANSI } from "../pdf/utils/encoding.js";

export function needsUnicode(text: string): boolean {
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0)!;
    if (!UNICODE_TO_WIN_ANSI.has(cp)) return true; // ✓ ★, combining, etc.
  }
  return false;
}

export function normalizeAndSegment(text: string): string[] {
  const normalized = text.normalize("NFC");

  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("pt", { granularity: "grapheme" });
    return [...segmenter.segment(normalized)].map(({ segment }) => segment);
  }

  // Simple grapheme splitting by character for runtimes without Intl.Segmenter.
  return Array.from(normalized);
}
