// ===== text/line-breaker.ts =====

import { ComputedStyle } from "../css/style.js";
import { estimateLineWidth } from "../layout/utils/text-metrics.js"; // Precisaremos exportar esta função

// Representa uma unidade inquebrável (palavra) ou um espaço flexível (cola).
interface TextItem {
  type: 'word' | 'space';
  text: string;
  width: number;
}

// O resultado da quebra de linha para um nó de texto.
export interface LineBox {
  text: string;
  width: number;
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
  if (!text.trim()) {
    return [];
  }

  const rawItems = segmentText(text);
  const items = measureItems(rawItems, style);
  const n = items.length;
  if (n === 0) return [];

  // Check if entire text fits on one line - if so, don't break it
  const totalWidth = items.reduce((sum, it) => sum + it.width, 0);
  if (totalWidth <= availableWidth) {
    return [{ text: text.trim(), width: totalWidth }];
  }

  const spaceWidth = estimateLineWidth(" ", style);

  // memo[i] armazena o custo mínimo (feiura) para quebrar os primeiros `i` itens.
  const memo: number[] = new Array(n + 1).fill(Infinity);
  // breaks[i] armazena o índice do início da última linha na quebra ótima para os primeiros `i` itens.
  const breaks: number[] = new Array(n + 1).fill(0);

  memo[0] = 0;

  for (let i = 1; i <= n; i++) {
    let lineWidth = 0;
    for (let j = i; j > 0; j--) {
      const item = items[j - 1];
      
      // Adiciona a largura do item atual. Se for um espaço entre palavras, usa a largura padrão do espaço.
      lineWidth += item.width;

      if (lineWidth > availableWidth) {
        break; // Esta linha é longa demais, não há como continuar a partir deste `j`.
      }

      // Calcula a "feiura" (badness) desta linha potencial (de j a i).
      // Uma função de custo simples é o quadrado da diferença de espaço.
      // Isso penaliza fortemente linhas desiguais.
      const slack = availableWidth - lineWidth;
      // Um custo de 100 por linha para preferir menos linhas.
      const cost = 100 + slack * slack;

      // Se encontramos um caminho melhor para o ponto `i`, atualize.
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
    let currentLine = "";
    let currentWidth = 0;
    for (const item of items) {
      if (item.type === 'word' && currentLine && currentWidth + item.width > availableWidth) {
        lines.push({ text: currentLine.trim(), width: currentWidth });
        currentLine = "";
        currentWidth = 0;
      }
      currentLine += item.text;
      currentWidth += item.width;
    }
    if (currentLine) {
        lines.push({ text: currentLine.trim(), width: currentWidth });
    }
    return lines;
  }
  
  // Reconstitui o caminho ótimo usando os backpointers em `breaks`.
  const lines: LineBox[] = [];
  let current = n;
  while (current > 0) {
    const prev = breaks[current];
    const lineItems = items.slice(prev, current);
    const text = lineItems.map(it => it.text).join("").trim();
    const width = lineItems.reduce((sum, it) => sum + it.width, 0);
    lines.unshift({ text, width });
    current = prev;
  }

  return lines;
}
