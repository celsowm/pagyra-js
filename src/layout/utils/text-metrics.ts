import { LayoutNode } from "../../dom/node.js";
import { resolvedLineHeight } from "../../css/style.js";
import type { ComputedStyle } from "../../css/style.js";
import type { TtfFontMetrics } from "../../types/fonts.js";
import { normalizeFontWeight } from "../../css/font-weight.js";
import { base14Widths } from "../../pdf/font/base14-widths.js";
import { applyTextTransform } from "../../text/text-transform.js";
import { hasFontVariantNumeric } from "../../css/properties/typography.js";

// Font family pattern for monospace detection
const MONO_FAMILY_PATTERN = /(mono|code|courier|console)/i;

// Character width coefficients for heuristic text width calculation
const CHARACTER_WIDTH_FACTORS = {
  SPACE: 0.32,
  DIGIT: 0.52,
  UPPER: 0.58,
  BASE: 0.5,
  PUNCTUATION: 0.35,
  IDEOGRAPHIC: 1.0
} as const;

// Heuristic width measurements tend to slightly overestimate glyph widths.
// Apply a calibration factor so line breaking can pack words closer to the real layout.
const WIDTH_CALIBRATION = 0.9;

// Font weight threshold above which fonts are considered bold for Base14 selection
const BASE14_BOLD_THRESHOLD = 600;

const BASE14_ALIAS = new Map<string, string>([
  ["helvetica", "Helvetica"],
  ["arial", "Helvetica"],
  ["sans-serif", "Helvetica"],
  ["times", "Times-Roman"],
  ["times-roman", "Times-Roman"],
  ["times new roman", "Times-Roman"],
  ["georgia", "Times-Roman"],
  ["serif", "Times-Roman"],
  ["courier", "Courier"],
  ["courier new", "Courier"],
  ["monaco", "Courier"],
  ["monospace", "Courier"],
]);

const BASE14_BOLD_VARIANT = new Map<string, string>([
  ["Times-Roman", "Times-Bold"],
  ["Helvetica", "Helvetica-Bold"],
  ["Courier", "Courier-Bold"],
]);

import type { FontEmbedder } from "../../pdf/font/embedder.js";

export function assignIntrinsicTextMetrics(root: LayoutNode, fontEmbedder: FontEmbedder | null): void {
  root.walk((node) => {
    if (!node.textContent) {
      return;
    }
    const trimmed = node.textContent;
    if (trimmed.length === 0) {
      node.intrinsicInlineSize = 0;
      node.intrinsicBlockSize = resolvedLineHeight(node.style);
      return;
    }
    const { inlineSize, blockSize } = measureText(trimmed, node.style, fontEmbedder);
    node.intrinsicInlineSize = inlineSize;
    node.intrinsicBlockSize = blockSize;
  });
}

function measureText(
  text: string,
  style: ComputedStyle,
  fontEmbedder: FontEmbedder | null
): { inlineSize: number; blockSize: number } {
  const effectiveText = applyTextTransform(text, style.textTransform);
  const lines = effectiveText.split(/\r?\n/);
  let maxLineWidth = 0;

  const fontWeight = typeof style.fontWeight === "number" ? style.fontWeight : 400;
  const fontStyle = style.fontStyle ?? "normal";
  const fontMetrics = fontEmbedder?.getMetrics(style.fontFamily ?? "", fontWeight, fontStyle);

  for (const line of lines) {
    const glyphWidth = measureTextWithGlyphs(line, style, fontMetrics ?? null);
    if (glyphWidth !== null) {
      maxLineWidth = Math.max(maxLineWidth, glyphWidth);
    } else {
      maxLineWidth = Math.max(maxLineWidth, estimateLineWidth(line, style));
    }
  }
  const lineHeight = resolvedLineHeight(style);
  const blockSize = Math.max(lineHeight, lines.length * lineHeight);
  return { inlineSize: maxLineWidth, blockSize };
}

export function estimateLineWidth(line: string, style: ComputedStyle): number {
  if (!line) {
    return 0;
  }
  const fontSize = style.fontSize || 16;
  const isMonospace = style.fontFamily ? MONO_FAMILY_PATTERN.test(style.fontFamily) : false;
  const baseFactor = isMonospace ? 0.6 : CHARACTER_WIDTH_FACTORS.BASE;
  const weightMultiplier = fontWeightWidthMultiplier(normalizeFontWeight(style.fontWeight));
  const letterSpacing = style.letterSpacing ?? 0;
  const wordSpacing = style.wordSpacing ?? 0;
  const spacingContribution = Math.max(line.length - 1, 0) * letterSpacing + countSpaces(line) * wordSpacing;

  const base14Width = measureUsingBase14(line, style);
  if (base14Width !== null) {
    return base14Width + spacingContribution;
  }

  let totalFactor = 0;

  for (const char of line) {
    totalFactor += factorForChar(char, baseFactor);
  }

  const heuristicWidth = totalFactor * fontSize * weightMultiplier;

  return heuristicWidth * WIDTH_CALIBRATION + spacingContribution;
}

function measureUsingBase14(text: string, style: ComputedStyle): number | null {
  const baseFont = resolveBase14Font(style);
  if (!baseFont) {
    return null;
  }
  const widths = base14Widths[baseFont];
  if (!widths) {
    return null;
  }
  const fontSize = style.fontSize || 16;
  let total = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) {
      return null;
    }
    // Handle Unicode characters that map to WinAnsi bytes (like bullet U+2022 -> 0x95)
    if (code > 255) {
      if (code === 0x2022) { // bullet
        const w = widths[0x95];
        if (w === undefined) return null;
        total += w;
        continue;
      }
      // Try diacritic fallback via NFD base letter (e.g., "ê" -> "e")
      const base = char.normalize("NFD").replace(/\p{M}+/gu, "");
      if (base && base.length === 1) {
        const baseCode = base.codePointAt(0)!;
        if (baseCode !== undefined && baseCode <= 255) {
          const w2 = widths[baseCode];
          if (w2 !== undefined) {
            total += w2;
            continue;
          }
        }
      }
      return null;
    }
    let w = widths[code];
    if (w === undefined) {
      // Try diacritic fallback via base letter
      const base = char.normalize("NFD").replace(/\p{M}+/gu, "");
      if (base && base.length === 1) {
        const baseCode = base.codePointAt(0)!;
        if (baseCode !== undefined && baseCode <= 255) {
          w = widths[baseCode];
        }
      }
      if (w === undefined) return null;
    }
    // Some extended entries may be overly large in datasets; clamp using base letter width
    if (w >= 900) {
      const base = char.normalize("NFD").replace(/\p{M}+/gu, "");
      if (base && base.length === 1) {
        const baseCode = base.codePointAt(0)!;
        if (baseCode !== undefined && baseCode <= 255) {
          const fallback = widths[baseCode];
          if (fallback !== undefined) {
            w = fallback;
          }
        }
      }
    }
    total += w;
  }
  return (total / 1000) * fontSize;
}

function resolveBase14Font(style: ComputedStyle): string | null {
  const tokens = parseFontFamily(style.fontFamily);
  if (tokens.length === 0) {
    return null;
  }
  const normalizedWeight = normalizeFontWeight(style.fontWeight);
  for (const token of tokens) {
    const alias = BASE14_ALIAS.get(token);
    if (!alias) {
      continue;
    }
    if (normalizedWeight >= BASE14_BOLD_THRESHOLD) {
      const boldVariant = BASE14_BOLD_VARIANT.get(alias);
      if (boldVariant) {
        return boldVariant;
      }
    }
    return alias;
  }
  return null;
}

function parseFontFamily(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((token) => stripQuotes(token.trim()).toLowerCase())
    .filter((token) => token.length > 0);
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function factorForChar(char: string, baseFactor: number): number {
  if (char === " ") {
    return CHARACTER_WIDTH_FACTORS.SPACE;
  }
  if (char === "\t") {
    return CHARACTER_WIDTH_FACTORS.SPACE * 4; // Tab is 4 spaces
  }
  if (isDigit(char)) {
    return CHARACTER_WIDTH_FACTORS.DIGIT;
  }
  if (isUpperCase(char)) {
    return baseFactor + (CHARACTER_WIDTH_FACTORS.UPPER - CHARACTER_WIDTH_FACTORS.BASE);
  }
  if (isPunctuation(char)) {
    return CHARACTER_WIDTH_FACTORS.PUNCTUATION;
  }
  if (isIdeograph(char)) {
    return CHARACTER_WIDTH_FACTORS.IDEOGRAPHIC;
  }
  return baseFactor;
}

function isUpperCase(char: string): boolean {
  return char >= "A" && char <= "Z";
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isPunctuation(char: string): boolean {
  return /[.,;:!?'"`~\-_/\\()[\]{}<>]/.test(char);
}

function isIdeograph(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) {
    return false;
  }
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Unified Ideographs Extension A
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0x3040 && code <= 0x309f) || // Hiragana
    (code >= 0x30a0 && code <= 0x30ff) || // Katakana
    (code >= 0xac00 && code <= 0xd7af) // Hangul Syllables
  );
}

function countSpaces(line: string): number {
  let count = 0;
  for (const char of line) {
    if (char === " ") {
      count += 1;
    }
  }
  return count;
}

export function measureTextWithGlyphs(
  text: string,
  style: ComputedStyle,
  fontMetrics: TtfFontMetrics | null
): number | null {
  if (!fontMetrics) {
    return null;
  }

  const unitsPerEm = fontMetrics.metrics.unitsPerEm;
  const kerning = fontMetrics.kerning;
  let totalWidth = 0;
  let prevGid: number | null = null;
  let glyphCount = 0;
  let spaceCount = 0;

  // Check for tabular-nums feature
  const fontVariantNumeric = style.fontVariantNumeric ?? [];
  const useTabularNums = hasFontVariantNumeric(fontVariantNumeric, "tabular-nums");
  const useSlashedZero = hasFontVariantNumeric(fontVariantNumeric, "slashed-zero");

  // For tabular-nums, compute max digit width
  let maxDigitWidth = 0;
  if (useTabularNums) {
    for (let d = 0; d <= 9; d++) {
      const codePoint = d + 0x30; // '0' is 0x30
      const glyphId = fontMetrics.cmap.getGlyphId(codePoint);
      const glyphMetrics = fontMetrics.glyphMetrics.get(glyphId);
      if (glyphMetrics) {
        maxDigitWidth = Math.max(maxDigitWidth, glyphMetrics.advanceWidth);
      }
    }
  }

  // For slashed-zero, the width would be needed for special rendering
  // This is reserved for future implementation when slashed-zero rendering is added

  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }

    let glyphId = fontMetrics.cmap.getGlyphId(codePoint);
    let glyphMetrics = fontMetrics.glyphMetrics.get(glyphId);

    // Handle tabular-nums: use max digit width for all digits
    if (useTabularNums && char >= "0" && char <= "9") {
      const digitCodePoint = char.codePointAt(0);
      if (digitCodePoint === undefined) {
        // Fall back to default
        if (glyphMetrics) {
          totalWidth += glyphMetrics.advanceWidth;
        }
        if (prevGid !== null && kerning) {
          const kernAdjust = kerning.get(prevGid)?.get(glyphId) ?? 0;
          if (kernAdjust !== 0) {
            totalWidth += kernAdjust;
          }
        }
        prevGid = glyphId;
        glyphCount += 1;
        continue;
      }
      const digitGlyphId = fontMetrics.cmap.getGlyphId(digitCodePoint);
      const digitGlyphMetrics = fontMetrics.glyphMetrics.get(digitGlyphId);
      if (digitGlyphMetrics) {
        totalWidth += maxDigitWidth;
        prevGid = digitGlyphId;
        glyphCount += 1;
        continue;
      } else {
        // Fall back to default width calculation for this digit
        if (glyphMetrics) {
          totalWidth += glyphMetrics.advanceWidth;
        }
        if (prevGid !== null && kerning) {
          const kernAdjust = kerning.get(prevGid)?.get(glyphId) ?? 0;
          if (kernAdjust !== 0) {
            totalWidth += kernAdjust;
          }
        }
        prevGid = glyphId;
        glyphCount += 1;
        continue;
      }
    }

    // Handle slashed-zero: add diagonal stroke effect (simulated by using zero width)
    if (useSlashedZero && char === "0") {
      // For now, we'll use the zero width as-is
      // In a full implementation, we'd render a line through the zero
    }

    if (glyphMetrics) {
      totalWidth += glyphMetrics.advanceWidth;
    }
    if (prevGid !== null && kerning) {
      const kernAdjust = kerning.get(prevGid)?.get(glyphId) ?? 0;
      if (kernAdjust !== 0) {
        totalWidth += kernAdjust;
      }
    }
    prevGid = glyphId;
    glyphCount += 1;
    if (char === " ") {
      spaceCount += 1;
    }
  }

  const scale = style.fontSize / unitsPerEm;
  const baseWidthPx = totalWidth * scale;
  const letterSpacing = style.letterSpacing ?? 0;
  const wordSpacing = style.wordSpacing ?? 0;
  const spacingContribution =
    Math.max(glyphCount - 1, 0) * letterSpacing + spaceCount * wordSpacing;

  return baseWidthPx + spacingContribution;
}

function fontWeightWidthMultiplier(weight: number): number {
  switch (weight) {
    case 100:
      return 0.92;
    case 200:
      return 0.94;
    case 300:
      return 0.96;
    case 400:
      return 1;
    case 500:
      return 1.02;
    case 600:
      return 1.04;
    case 700:
      return 1.08;
    case 800:
      return 1.1;
    case 900:
      return 1.12;
    default:
      return 1;
  }
}
