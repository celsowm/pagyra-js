import { resolvedLineHeight } from "../../css/style.js";
// import type { ComputedStyle } from "../../css/style.js";
import { estimateLineWidth } from "../../layout/utils/text-metrics.js";
import type { LayoutNode } from "../../dom/node.js";
import type { Run, Decorations, RGBA } from "../types.js";
import { applyTextTransform } from "../../text/text-transform.js";
import { resolveTextShadows } from "../../pdf/utils/shadow-utils.js";
import { resolveTextAlign, resolveFallbackStartX } from "./text-alignment-resolver.js";
import { resolveDecorations } from "./text-decoration-utils.js";

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
  const letterSpacing = node.style.letterSpacing;


  // Se o layout calculou inlineRuns (novo builder), use-os.
  if (node.inlineRuns && node.inlineRuns.length > 0) {
    for (const inlineRun of node.inlineRuns) {
      const justifyLine =
        effectiveTextAlign === "justify" && !inlineRun.isLastLine;

      let wordSpacing: number | undefined;
      const targetWidth =
        inlineRun.targetWidth ?? inlineRun.lineWidth ?? inlineRun.width;
      const lineWidth = inlineRun.lineWidth ?? inlineRun.width;

      if (justifyLine && inlineRun.spaceCount > 0) {
        const slack = Math.max(targetWidth - lineWidth, 0);
        if (slack > 0) {
          wordSpacing = slack / inlineRun.spaceCount;
        }
      }

      // Count spaces *inside this run's text*
      const spacesInRun =
        inlineRun.text.split("").reduce(
          (count, ch) => (ch === " " ? count + 1 : count),
          0,
        );

      const extraWidth =
        spacesInRun > 0 && wordSpacing !== undefined
          ? spacesInRun * wordSpacing
          : 0;

      // Run-local visual width (base width + justified expansion)
      const advanceWidth = inlineRun.width + extraWidth;

      const resolvedShadows = resolveTextShadows(node, defaultColor);
      const baseLineMatrix = {
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: inlineRun.startX,
        f: inlineRun.baseline,
      };

      runs.push({
        text: inlineRun.text.normalize("NFC"),
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        fontVariant,
        fill: defaultColor,
        letterSpacing,
        lineMatrix: baseLineMatrix,
        wordSpacing,
        decorations: decoration ? { ...decoration } : undefined,
        advanceWidth,
        textShadows: resolvedShadows,

        // New metadata
        lineIndex: inlineRun.lineIndex,
        isLastLine: inlineRun.isLastLine,
        spacesInRun,
      });
    }
    return runs;
  }

  // Se o layout calculou caixas de linha, use-as (caminho leg legado).
  if (node.lineBoxes && node.lineBoxes.length > 0) {
    const lineHeight = resolvedLineHeight(node.style);
    // For table cells, we need the parent cell's contentWidth, not the text node's width
    const parentIsTableCell = node.parent && (node.parent.tagName === 'td' || node.parent.tagName === 'th');
    const contentWidth = parentIsTableCell
      ? Math.max(node.parent!.box.contentWidth, 0)
      : Math.max(node.box.contentWidth, 0);
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

      // Apply horizontal text alignment
      let startX = node.box.x;
      if (advanceWidth > 0 && Number.isFinite(contentWidth) && contentWidth > 0) {
        const slack = Math.max(contentWidth - advanceWidth, 0);
        if (effectiveTextAlign === "center") {
          startX = node.box.x + slack / 2;
        } else if (effectiveTextAlign === "right" || effectiveTextAlign === "end") {
          startX = node.box.x + slack;
        }
      }

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
        letterSpacing,
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
      letterSpacing,
      fill: defaultColor,
      lineMatrix: baseLineMatrix,
      decorations: decoration ? { ...decoration } : undefined,
      advanceWidth,
      textShadows: resolvedShadows,
    }];
  }

  return [];
}
