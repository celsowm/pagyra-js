import { LayoutNode } from "../../dom/node.js";
import { resolvedLineHeight } from "../../css/style.js";
import type { ComputedStyle } from "../../css/style.js";
import { normalizeFontWeight } from "../../css/font-weight.js";

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
  let totalFactor = 0;

  for (const char of line) {
    totalFactor += factorForChar(char, baseFactor);
  }

  const letterSpacing = style.letterSpacing ?? 0;
  const wordSpacing = style.wordSpacing ?? 0;
  const spacingContribution = Math.max(line.length - 1, 0) * letterSpacing + countSpaces(line) * wordSpacing;
  const heuristicWidth = totalFactor * fontSize * weightMultiplier;

  return heuristicWidth * WIDTH_CALIBRATION + spacingContribution;
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
