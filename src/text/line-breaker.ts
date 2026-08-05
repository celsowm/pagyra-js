// ===== text/line-breaker.ts =====

import { WhiteSpace } from "../css/enums.js";
import { ComputedStyle } from "../css/style.js";
import { estimateLineWidth, measureTextWithGlyphs } from "../layout/utils/text-metrics.js";
import type { FontEmbedder } from "../pdf/font/embedder.js";
import { applyTextTransform } from "./text-transform.js";

export interface TextItem {
  type: 'word' | 'space';
  text: string;
  width: number;
}

export interface LineBox {
  text: string;
  width: number;
  spaceCount: number;
  targetWidth: number;
}

function segmentText(text: string): { type: 'word' | 'space', text: string }[] {
  const segments: { type: 'word' | 'space', text: string }[] = [];
  const regex = /(\s+)|([^\s]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      segments.push({ type: 'space', text: match[1] });
    } else if (match[2]) {
      segments.push({ type: 'word', text: match[2] });
    }
  }
  return segments;
}

function measureItems(
  segments: { type: 'word' | 'space', text: string }[],
  style: ComputedStyle,
  fontEmbedder: FontEmbedder | null
): TextItem[] {
  const fontWeight = typeof style.fontWeight === "number" ? style.fontWeight : 400;
  const fontStyle = style.fontStyle ?? "normal";
  const fontMetrics = fontEmbedder?.getMetrics(style.fontFamily ?? "", fontWeight, fontStyle);

  return segments.map(s => {
    const glyphWidth = measureTextWithGlyphs(s.text, style, fontMetrics ?? null);
    return {
      ...s,
      width: glyphWidth ?? estimateLineWidth(s.text, style),
    };
  });
}

function splitWordItem(
  item: TextItem,
  style: ComputedStyle,
  availableWidth: number
): TextItem[] {
  if (availableWidth <= 0) {
    return [item];
  }

  const pieces: TextItem[] = [];
  let buffer = "";
  let bufferWidth = 0;
  const letterSpacing = style.letterSpacing ?? 0;

  const flush = () => {
    if (!buffer) {
      return;
    }
    pieces.push({ type: "word", text: buffer, width: bufferWidth });
    buffer = "";
    bufferWidth = 0;
  };

  for (const char of Array.from(item.text)) {
    const charWidth = estimateLineWidth(char, style);
    const candidateWidth = bufferWidth + (buffer ? letterSpacing : 0) + charWidth;

    if (buffer && candidateWidth > availableWidth) {
      flush();
      buffer = char;
      bufferWidth = charWidth;
      continue;
    }

    if (!buffer && charWidth > availableWidth) {
      pieces.push({ type: "word", text: char, width: charWidth });
      continue;
    }

    buffer += char;
    bufferWidth = candidateWidth;
  }

  flush();
  return pieces.length ? pieces : [item];
}

function enforceOverflowWrap(
  items: TextItem[],
  style: ComputedStyle,
  availableWidth: number,
  mode: ComputedStyle["overflowWrap"] | undefined
): TextItem[] {
  if (!mode || mode === "normal") {
    return items;
  }

  const adjusted: TextItem[] = [];
  for (const item of items) {
    if (item.type !== "word" || item.width <= availableWidth) {
      adjusted.push(item);
      continue;
    }
    adjusted.push(...splitWordItem(item, style, availableWidth));
  }

  return adjusted.length ? adjusted : items;
}

function enforceEmergencyBreak(
  items: TextItem[],
  style: ComputedStyle,
  availableWidth: number
): TextItem[] {
  if (!(availableWidth > 0)) {
    return items;
  }

  let needsBreak = false;
  for (const item of items) {
    if (item.type === "word" && item.width > availableWidth) {
      needsBreak = true;
      break;
    }
  }
  if (!needsBreak) {
    return items;
  }

  const adjusted: TextItem[] = [];
  for (const item of items) {
    if (item.type === "word" && item.width > availableWidth) {
      adjusted.push(...splitWordItem(item, style, availableWidth));
    } else {
      adjusted.push(item);
    }
  }
  return adjusted.length ? adjusted : items;
}

function countJustifiableSpaces(items: TextItem[]): number {
  let firstWord = -1;
  let lastWord = -1;

  for (let index = 0; index < items.length; index++) {
    if (items[index].type === "word") {
      if (firstWord < 0) {
        firstWord = index;
      }
      lastWord = index;
    }
  }

  if (firstWord < 0 || firstWord === lastWord) {
    return 0;
  }

  let count = 0;
  for (let index = firstWord + 1; index < lastWord; index++) {
    if (items[index].type === "space") {
      count += 1;
    }
  }
  return count;
}

function shouldTrimLineEdges(style: ComputedStyle): boolean {
  const mode = style.whiteSpace;
  return (
    mode === WhiteSpace.Normal ||
    mode === WhiteSpace.NoWrap ||
    mode === WhiteSpace.PreLine
  );
}

function buildLineBox(items: TextItem[], availableWidth: number, trimEdges: boolean): LineBox | null {
  let start = 0;
  let end = items.length;

  if (trimEdges) {
    while (start < end && items[start].type === "space") {
      start += 1;
    }
    while (end > start && items[end - 1].type === "space") {
      end -= 1;
    }
  }

  if (start >= end) {
    return null;
  }

  const trimmed = items.slice(start, end);
  const text = trimmed.map((it) => it.text).join("");
  const width = trimmed.reduce((sum, it) => sum + it.width, 0);

  return {
    text,
    width,
    spaceCount: countJustifiableSpaces(trimmed),
    targetWidth: availableWidth,
  };
}

export function breakTextIntoLines(
  text: string,
  style: ComputedStyle,
  availableWidth: number,
  fontEmbedder: FontEmbedder | null = null
): LineBox[] {
  const effectiveText = applyTextTransform(text, style.textTransform);
  if (effectiveText.length === 0) {
    return [];
  }

  const rawItems = segmentText(effectiveText);
  let items = measureItems(rawItems, style, fontEmbedder);
  items = enforceOverflowWrap(items, style, availableWidth, style.overflowWrap);
  items = enforceEmergencyBreak(items, style, availableWidth);
  const n = items.length;
  if (n === 0) return [];
  const trimEdges = shouldTrimLineEdges(style);

  const totalWidth = items.reduce((sum, it) => sum + it.width, 0);
  if (totalWidth <= availableWidth) {
    const singleLine = buildLineBox(items, availableWidth, trimEdges);
    return singleLine ? [singleLine] : [];
  }

  const memo: number[] = new Array(n + 1).fill(Infinity);
  const breaks: number[] = new Array(n + 1).fill(0);
  memo[0] = 0;

  for (let i = 1; i <= n; i++) {
    let lineWidth = 0;
    let hasWord = false;
    for (let j = i; j > 0; j--) {
      const item = items[j - 1];

      if (item.type === "space") {
        if (!hasWord && trimEdges) {
          continue;
        }
        lineWidth += item.width;
        if (lineWidth > availableWidth) {
          break;
        }
        if (!trimEdges && !hasWord) {
          const slack = availableWidth - lineWidth;
          const cost = 100 + slack * slack;
          if (memo[j - 1] + cost < memo[i]) {
            memo[i] = memo[j - 1] + cost;
            breaks[i] = j - 1;
          }
        }
        continue;
      }

      lineWidth += item.width;
      hasWord = true;

      if (lineWidth > availableWidth) {
        break;
      }

      const slack = availableWidth - lineWidth;
      const cost = 100 + slack * slack;

      if (memo[j - 1] + cost < memo[i]) {
        memo[i] = memo[j - 1] + cost;
        breaks[i] = j - 1;
      }
    }
  }

  if (!isFinite(memo[n])) {
    const lines: LineBox[] = [];
    let currentWidth = 0;
    let currentItems: TextItem[] = [];
    const pushCurrent = () => {
      const line = buildLineBox(currentItems, availableWidth, trimEdges);
      if (line) {
        lines.push(line);
      }
    };

    for (const item of items) {
      if (trimEdges && item.type === "space" && currentItems.length === 0) {
        continue;
      }
      if (item.type === 'word' && currentItems.length > 0 && currentWidth + item.width > availableWidth) {
        pushCurrent();
        currentWidth = 0;
        currentItems = [];
      }
      currentItems.push(item);
      currentWidth += item.width;
    }
    if (currentItems.length > 0) {
      pushCurrent();
    }
    return lines;
  }

  const lines: LineBox[] = [];
  let current = n;
  while (current > 0) {
    const prev = breaks[current];
    const lineItems = items.slice(prev, current);
    const line = buildLineBox(lineItems, availableWidth, trimEdges);
    if (line) {
      lines.push(line);
    }
    current = prev;
  }

  lines.reverse();
  return lines;
}
