import { resolvedLineHeight } from "../../css/style.js";
import type { ComputedStyle } from "../../css/style.js";
import { estimateLineWidth } from "../../layout/utils/text-metrics.js";
import type { LayoutNode } from "../../dom/node.js";
import type { Run, Decorations, RGBA } from "../types.js";
import { applyTextTransform } from "../../text/text-transform.js";
import { resolveTextShadows } from "../../pdf/utils/shadow-utils.js";
import { Display, JustifyContent } from "../../css/enums.js";

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
  const fontVariant = node.style.fontVariant;

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
      const resolvedShadows = resolveTextShadows(node, defaultColor);
      const baseLineMatrix = { a: 1, b: 0, c: 0, d: 1, e: startX, f: baseline };
      runs.push({
        text: normalizedText,
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        fontVariant,
        fill: defaultColor,
        lineMatrix: baseLineMatrix,
        wordSpacing,
        decorations: decoration ? { ...decoration } : undefined,
        advanceWidth,
        textShadows: resolvedShadows,
      });
    }
    return runs;
  }
  
  // Fallback para o comportamento original se não houver quebra de linha calculada
  if (node.textContent) {
    const raw = node.textContent;
    const transformed = applyTextTransform(raw, node.style.textTransform);
    const normalized = transformed.normalize("NFC");
    // Se não houver lineBoxes, a baseline é a calculada para a caixa inteira.
  const baseline = node.box.baseline > 0 ? node.box.baseline : node.box.y + node.box.contentHeight;
  const advanceWidth = Math.max(estimateLineWidth(normalized, node.style), 0);
  const startX = resolveFallbackStartX(node, advanceWidth, effectiveTextAlign);

    const resolvedShadows = resolveTextShadows(node, defaultColor);
    const baseLineMatrix = { a: 1, b: 0, c: 0, d: 1, e: startX, f: baseline };
    return [{
      text: normalized,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      fontVariant,
      fill: defaultColor,
      lineMatrix: baseLineMatrix,
      decorations: decoration ? { ...decoration } : undefined,
      advanceWidth,
      textShadows: resolvedShadows,
    }];
  }

  return [];
}

function resolveFallbackStartX(node: LayoutNode, advanceWidth: number, textAlign?: string): number {
  let startX = node.box.x;
  if (advanceWidth > 0 && Number.isFinite(node.box.contentWidth) && node.box.contentWidth > 0) {
    const slack = Math.max(node.box.contentWidth - advanceWidth, 0);
    if (textAlign === "center") {
      startX = node.box.x + slack / 2;
    } else if (textAlign === "right" || textAlign === "end") {
      startX = node.box.x + slack;
    } else if (textAlign === "left" || textAlign === "start") {
      startX = node.box.x;
    }
  }

  const flexStart = resolveFlexSingleChildStart(node, advanceWidth);
  if (flexStart !== null) {
    startX = flexStart;
  }
  return startX;
}

function resolveFlexSingleChildStart(node: LayoutNode, advanceWidth: number): number | null {
  if (!node.parent || advanceWidth <= 0) {
    return null;
  }
  const parent = node.parent;
  if (parent.style.display !== Display.Flex) {
    return null;
  }
  if (parent.children.length !== 1) {
    return null;
  }
  const direction = parent.style.flexDirection ?? "row";
  if (direction !== "row" && direction !== "row-reverse") {
    return null;
  }
  const justify = parent.style.justifyContent ?? JustifyContent.FlexStart;
  const parentWidth = Number.isFinite(parent.box.contentWidth) ? parent.box.contentWidth : 0;
  if (!(parentWidth > 0)) {
    return null;
  }
  const constrainedWidth = advanceWidth > parentWidth ? parentWidth : advanceWidth;
  const slack = Math.max(parentWidth - constrainedWidth, 0);
  const parentStart = parent.box.x;
  const parentEnd = parentStart + parentWidth;
  const isReverse = direction === "row-reverse";

  switch (justify) {
    case JustifyContent.Center:
      return parentStart + slack / 2;
    case JustifyContent.FlexEnd:
    case JustifyContent.End:
    case JustifyContent.Right:
      return isReverse ? parentStart : parentEnd - constrainedWidth;
    case JustifyContent.FlexStart:
    case JustifyContent.Start:
    case JustifyContent.Left:
      return isReverse ? parentEnd - constrainedWidth : parentStart;
    default:
      return null;
  }
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
