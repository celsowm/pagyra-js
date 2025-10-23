import { LayoutNode } from "../../dom/node.js";
import { resolvedLineHeight } from "../../css/style.js";
import type { ComputedStyle } from "../../css/style.js";
import { normalizeFontWeight } from "../../css/font-weight.js";
import { base14Widths } from "../../pdf/font/base14-widths.js";

const MONO_FAMILY_PATTERN = /(mono|code|courier|console)/i;
const SPACE_WIDTH_FACTOR = 0.32;
const DIGIT_WIDTH_FACTOR = 0.52;
const UPPER_WIDTH_FACTOR = 0.58;
const BASE_WIDTH_FACTOR = 0.5;
const PUNCT_WIDTH_FACTOR = 0.35;
const IDEOGRAPHIC_WIDTH_FACTOR = 1.0;
// Heuristic width measurements tend to slightly overestimate glyph widths.
// Apply a calibration factor so line breaking can pack words closer to the real layout.
const WIDTH_CALIBRATION = 0.9;
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

export function assignIntrinsicTextMetrics(root: LayoutNode): void {
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
    const { inlineSize, blockSize } = measureText(trimmed, node.style);
    node.intrinsicInlineSize = inlineSize;
    node.intrinsicBlockSize = blockSize;
  });
}

function measureText(text: string, style: ComputedStyle): { inlineSize: number; blockSize: number } {
  const lines = text.split(/\r?\n/);
  let maxLineWidth = 0;
  for (const line of lines) {
    maxLineWidth = Math.max(maxLineWidth, estimateLineWidth(line, style));
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
  const baseFactor = isMonospace ? 0.6 : BASE_WIDTH_FACTOR;
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
    if (code === undefined || code > 255) {
      return null;
    }
    const width = widths[code];
    if (width === undefined) {
      return null;
    }
    total += width;
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
    return SPACE_WIDTH_FACTOR;
  }
  if (char === "\t") {
    return SPACE_WIDTH_FACTOR * 4;
  }
  if (isDigit(char)) {
    return DIGIT_WIDTH_FACTOR;
  }
  if (isUpperCase(char)) {
    return baseFactor + (UPPER_WIDTH_FACTOR - BASE_WIDTH_FACTOR);
  }
  if (isPunctuation(char)) {
    return PUNCT_WIDTH_FACTOR;
  }
  if (isIdeograph(char)) {
    return IDEOGRAPHIC_WIDTH_FACTOR;
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
