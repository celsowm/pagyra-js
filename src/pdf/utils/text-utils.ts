import { resolvedLineHeight } from "../../css/style.js";
import type { ComputedStyle } from "../../css/style.js";
import { estimateLineWidth } from "../../layout/utils/text-metrics.js";
import type { LayoutNode } from "../../dom/node.js";
import type { Run, Decorations, RGBA, Rect } from "../types.js";

export function resolveTextAlign(node: LayoutNode): string | undefined {
  let current: LayoutNode | null = node;
  while (current) {
    const value = current.style.textAlign;
    if (value && value !== "start" && value !== "auto") {
      return value;
    }
    current = current.parent;
  }
  return undefined;
}

export function createTextRuns(node: LayoutNode, color: RGBA | undefined, inheritedDecorations?: Decorations): Run[] {
  const runs: Run[] = [];
  const defaultColor = color ?? { r: 0, g: 0, b: 0, a: 1 };
  const effectiveTextAlign = resolveTextAlign(node) ?? node.style.textAlign;
  const decoration = inheritedDecorations ?? resolveDecorations(node.style);
  const fontFamily = node.style.fontFamily ?? "sans-serif";
  const fontSize = node.style.fontSize;
  const fontWeight = node.style.fontWeight;
  const fontStyle = node.style.fontStyle;

  // Debug fontStyle for em and strong elements
  if (node.tagName === 'em' || node.tagName === 'strong' || (node.textContent && (node.textContent.includes('itálico') || node.textContent.includes('negrito')))) {
    console.log("🔍 CREATE TEXTRUNS DEBUG:", {
      tagName: node.tagName,
      textContent: node.textContent,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle
    });
  }

  // Se o layout calculou caixas de linha, use-as.
  if (node.lineBoxes && node.lineBoxes.length > 0) {
    const lineHeight = resolvedLineHeight(node.style);
    const contentWidth = Math.max(node.box.contentWidth, 0);
    // Alignment logic
    let alignY = node.box.y;
    // Vertical alignment
    let totalTextHeight = node.lineBoxes.length * lineHeight;
    if (node.style.verticalAlign === "middle") {
      alignY = node.box.y + (node.box.contentHeight - totalTextHeight) / 2;
    } else if (node.style.verticalAlign === "bottom") {
      alignY = node.box.y + (node.box.contentHeight - totalTextHeight);
    }
    const justify = effectiveTextAlign === "justify";
    for (let i = 0; i < node.lineBoxes.length; i++) {
      const line = node.lineBoxes[i];
      const normalizedText = line.text.normalize("NFC");
      const baseWidth = line.width ?? estimateLineWidth(normalizedText, node.style);
      const lineYOffset = i * lineHeight;
      const baseline = alignY + lineYOffset + fontSize;
      const startX = node.box.x;
      let wordSpacing: number | undefined;
      if (justify && i < node.lineBoxes.length - 1) {
        const gapCount = line.spaceCount ?? 0;
        if (gapCount > 0) {
          const targetWidth = line.targetWidth ?? contentWidth ?? baseWidth;
          const slack = Math.max(targetWidth - baseWidth, 0);
          if (slack > 0) {
            wordSpacing = slack / gapCount;
          }
        }
      }
      const targetWidth = line.targetWidth ?? baseWidth;
      const advanceWidth =
        wordSpacing !== undefined && wordSpacing !== 0 && targetWidth > 0
          ? Math.max(targetWidth, baseWidth)
          : Math.max(baseWidth, 0);
      runs.push({
        text: normalizedText,
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        fill: defaultColor,
        lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: startX, f: baseline },
        wordSpacing,
        decorations: decoration ? { ...decoration } : undefined,
        advanceWidth,
      });
    }
    return runs;
  }
  
  // Fallback para o comportamento original se não houver quebra de linha calculada
  if (node.textContent) {
    const raw = node.textContent;
    const normalized = raw.normalize("NFC");
    // Se não houver lineBoxes, a baseline é a calculada para a caixa inteira.
    const baseline = node.box.baseline > 0 ? node.box.baseline : node.box.y + node.box.contentHeight;
    const advanceWidth = Math.max(estimateLineWidth(normalized, node.style), 0);
    const startX = node.box.x;

    return [{
      text: normalized,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      fill: defaultColor,
      lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: startX, f: baseline },
      decorations: decoration ? { ...decoration } : undefined,
      advanceWidth,
    }];
  }

  return [];
}

export function resolveDecorations(style: ComputedStyle): Decorations | undefined {
  const value = style.textDecorationLine?.trim().toLowerCase();
  if (!value || value === "none") {
    return undefined;
  }
  const tokens = value.split(/\s+/);
  const decoration: Decorations = {};
  for (const token of tokens) {
    switch (token) {
      case "underline":
        decoration.underline = true;
        break;
      case "overline":
        decoration.overline = true;
        break;
      case "line-through":
        decoration.lineThrough = true;
        break;
      default:
        break;
    }
  }
  return decoration.underline || decoration.overline || decoration.lineThrough ? decoration : undefined;
}
