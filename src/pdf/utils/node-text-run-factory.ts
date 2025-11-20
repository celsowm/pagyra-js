import type { LayoutNode } from "../../dom/node.js";
import type { RenderBox, Rect, RGBA, Run, Decorations } from "../types.js";
import type { Matrix } from "../../geometry/matrix.js";
import { createTextRuns } from "./text-utils.js";
import { createListMarkerRun } from "./list-utils.js";
import { svgMatrixToPdf } from "../transform-adapter.js";
import { multiplyMatrices } from "../../geometry/matrix.js";
import type { FontResolver } from "../../fonts/types.js";
import type { GlyphRun } from "../../layout/text-run.js";

export interface NodeTextRunContext {
  node: LayoutNode;
  children: RenderBox[];
  borderBox: Rect;
  contentBox: Rect;
  textColor?: RGBA;
  decorations?: Decorations;
  transform?: Matrix;
  fallbackColor: RGBA;
  fontResolver?: FontResolver;
}

export function buildNodeTextRuns(context: NodeTextRunContext): Run[] {
  const { node, children, borderBox, contentBox, textColor, decorations, transform, fallbackColor, fontResolver } = context;
  const textRuns = createTextRuns(node, textColor, decorations);

  // If we have a fontResolver, enhance text runs with GlyphRun data
  if (fontResolver) {
    enrichTextRunsWithGlyphs(textRuns, fontResolver);
  }

  if (node.tagName === "li") {
    const markerRun = createListMarkerRun(node, contentBox, children, textColor ?? fallbackColor);
    if (markerRun) {
      textRuns.unshift(markerRun);
    }
  }

  if (transform && textRuns.length > 0) {
    applyTransformToTextRuns(textRuns, transform, borderBox);
  }

  return textRuns;
}

function applyTransformToTextRuns(runs: Run[], cssMatrix: Matrix, originBox: Rect): void {
  if (runs.length === 0) {
    return;
  }
  const pdfMatrix = svgMatrixToPdf(cssMatrix);
  if (!pdfMatrix) {
    return;
  }
  const baseOriginX = Number.isFinite(originBox.x) ? originBox.x : 0;
  const baseOriginY = Number.isFinite(originBox.y) ? originBox.y : 0;
  const originWidth = Number.isFinite(originBox.width) ? originBox.width : 0;
  const originHeight = Number.isFinite(originBox.height) ? originBox.height : 0;
  const originX = baseOriginX + originWidth / 2;
  const originY = baseOriginY + originHeight / 2;
  const toOrigin = translationMatrix(-originX, -originY);
  const fromOrigin = translationMatrix(originX, originY);
  for (const run of runs) {
    const baseMatrix = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const localMatrix = multiplyMatrices(toOrigin, baseMatrix);
    const transformedLocal = multiplyMatrices(pdfMatrix, localMatrix);
    run.lineMatrix = multiplyMatrices(fromOrigin, transformedLocal);
  }
}

function translationMatrix(tx: number, ty: number): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}

/**
 * Enriches text runs with GlyphRun data for TTF-based rendering.
 * For each run, resolves the font, maps text to glyph IDs, and computes positions.
 */
function enrichTextRunsWithGlyphs(runs: Run[], fontResolver: FontResolver): void {
  for (const run of runs) {
    try {
      // Resolve the font synchronously if possible
      const font = fontResolver.resolveSync
        ? fontResolver.resolveSync(run.fontFamily, run.fontWeight, run.fontStyle)
        : undefined;

      if (!font) {
        // If we can't resolve synchronously, skip glyph enrichment for now
        continue;
      }

      // Map Unicode text to glyph IDs
      const glyphIds: number[] = [];
      const positions: { x: number; y: number }[] = [];
      let currentX = 0;

      for (let i = 0; i < run.text.length; i++) {
        const codePoint = run.text.codePointAt(i) ?? 0;
        const glyphId = font.metrics.cmap.getGlyphId(codePoint);

        glyphIds.push(glyphId);

        // Get advance width for this glyph
        const glyphMetric = font.metrics.glyphMetrics.get(glyphId);
        const advanceWidth = glyphMetric?.advanceWidth ?? 0;

        // Scale advance width to font size
        const unitsPerEm = font.metrics.metrics.unitsPerEm;
        const scaledAdvance = (advanceWidth / unitsPerEm) * run.fontSize;

        positions.push({ x: currentX, y: 0 });
        currentX += scaledAdvance;

        // Handle surrogate pairs (advance i if this was a surrogate pair)
        if (codePoint > 0xFFFF) {
          i++;
        }
      }

      // Attach GlyphRun to the Run object
      const glyphRun: GlyphRun = {
        font,
        glyphIds,
        positions,
        text: run.text,
        fontSize: run.fontSize,
        width: currentX,
      };

      run.glyphs = glyphRun;
    } catch (error) {
      // If font resolution or glyph mapping fails, continue without glyph data
      console.warn(`Failed to create GlyphRun for text "${run.text}": ${error}`);
    }
  }
}
