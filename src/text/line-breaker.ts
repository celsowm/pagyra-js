// ===== text/line-breaker.ts =====

import { WhiteSpace } from "../css/enums.js";
import { ComputedStyle } from "../css/style.js";
import { estimateLineWidth } from "../layout/utils/text-metrics.js"; // Precisaremos exportar esta função

// Representa uma unidade inquebrável (palavra) ou um espaço flexível (cola).
export interface TextItem {
  type: 'word' | 'space';
  text: string;
  width: number;
}

// O resultado da quebra de linha para um nó de texto.
export interface LineBox {
  text: string;
  width: number;
  spaceCount: number;
  targetWidth: number;
}

/**
 * Segmenta uma string de texto em palavras e espaços.
 */
function segmentText(text: string): { type: 'word' | 'space', text: string }[] {
  // Uma segmentação simples baseada em espaços. Uma implementação mais robusta
  // poderia usar Intl.Segmenter ou lidar com múltiplos tipos de espaços.
  const segments: { type: 'word' | 'space', text: string }[] = [];
  const regex = /(\s+)|([^\s]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) { // É um espaço
      segments.push({ type: 'space', text: match[1] });
    } else if (match[2]) { // É uma palavra
      segments.push({ type: 'word', text: match[2] });
    }
  }
  return segments;
}

/**
 * Mede a largura de cada palavra e espaço.
 */
function measureItems(segments: { type: 'word' | 'space', text: string }[], style: ComputedStyle): TextItem[] {
  return segments.map(s => ({
    ...s,
    width: estimateLineWidth(s.text, style),
  }));
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

  const flush = () => {
    if (!buffer) {
      return;
    }
    pieces.push({ type: "word", text: buffer, width: bufferWidth });
    buffer = "";
    bufferWidth = 0;
  };

  for (const char of Array.from(item.text)) {
    const candidate = buffer + char;
    const candidateWidth = estimateLineWidth(candidate, style);

    if (buffer && candidateWidth > availableWidth) {
      flush();
      buffer = char;
      bufferWidth = estimateLineWidth(char, style);
      continue;
    }

    if (!buffer && candidateWidth > availableWidth) {
      pieces.push({ type: "word", text: char, width: candidateWidth });
      buffer = "";
      bufferWidth = 0;
      continue;
    }

    buffer = candidate;
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
    if (item.type !== "word") {
      adjusted.push(item);
      continue;
    }
    if (item.width <= availableWidth) {
      adjusted.push(item);
      continue;
    }
    adjusted.push(...splitWordItem(item, style, availableWidth));
  }

  return adjusted.length ? adjusted : items;
}

function countJustifiableSpaces(items: TextItem[]): number {
  let count = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.type !== "space") {
      continue;
    }
    const hasWordBefore = items.slice(0, index).some((candidate) => candidate.type === "word");
    if (!hasWordBefore) {
      continue;
    }
    const hasWordAfter = items.slice(index + 1).some((candidate) => candidate.type === "word");
    if (hasWordAfter) {
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

/**
 * Implementa um algoritmo de quebra de linha inspirado em Knuth-Plass
 * usando programação dinâmica para encontrar o layout ótimo.
 *
 * @param text O texto a ser quebrado.
 * @param style O estilo computado a ser usado para medição.
 * @param availableWidth A largura disponível para o texto.
 * @returns Um array de objetos LineBox representando as linhas ótimas.
 */
export function breakTextIntoLines(text: string, style: ComputedStyle, availableWidth: number): LineBox[] {
  if (text.length === 0) {
    return [];
  }

  const rawItems = segmentText(text);
  let items = measureItems(rawItems, style);
  items = enforceOverflowWrap(items, style, availableWidth, style.overflowWrap);
  const n = items.length;
  if (n === 0) return [];
  const trimEdges = shouldTrimLineEdges(style);

  // Check if entire text fits on one line - if so, keep a single trimmed line
  const totalWidth = items.reduce((sum, it) => sum + it.width, 0);
  if (totalWidth <= availableWidth) {
    const singleLine = buildLineBox(items, availableWidth, trimEdges);
    return singleLine ? [singleLine] : [];
  }

  // memo[i] armazena o custo mínimo (feiura) para quebrar os primeiros `i` itens.
  const memo: number[] = new Array(n + 1).fill(Infinity);
  // breaks[i] armazena o índice do início da última linha na quebra ótima para os primeiros `i` itens.
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
        break; // Esta linha é longa demais, não há como continuar a partir deste `j`.
      }

      const slack = availableWidth - lineWidth;
      const cost = 100 + slack * slack;

      if (memo[j - 1] + cost < memo[i]) {
        memo[i] = memo[j - 1] + cost;
        breaks[i] = j - 1;
      }
    }
  }

  // Se memo[n] é infinito, significa que uma única palavra é mais larga que
  // a linha, então recorremos a uma quebra forçada.
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
  
  // Reconstitui o caminho ótimo usando os backpointers em `breaks`.
  const lines: LineBox[] = [];
  let current = n;
  while (current > 0) {
    const prev = breaks[current];
    const lineItems = items.slice(prev, current);
    const line = buildLineBox(lineItems, availableWidth, trimEdges);
    if (line) {
      lines.unshift(line);
    }
    current = prev;
  }

  return lines;
}
