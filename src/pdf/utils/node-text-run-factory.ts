import type { LayoutNode } from "../../dom/node.js";
import type { RenderBox, Rect, RGBA, Run, Decorations, GradientBackground } from "../types.js";
import type { Matrix } from "../../geometry/matrix.js";
import { createTextRuns } from "./text-utils.js";
import { createListMarkerRun } from "./list-utils.js";
import { svgMatrixToPdf } from "../transform-adapter.js";
import { multiplyMatrices } from "../../geometry/matrix.js";
import type { FontResolver } from "../../fonts/types.js";
import type { GlyphRun } from "../../layout/text-run.js";
import type { UnifiedFont } from "../../fonts/types.js";
import type { KerningMap } from "../../types/fonts.js";

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
  textGradient?: GradientBackground;
}

export function buildNodeTextRuns(context: NodeTextRunContext): Run[] {
  const { node, children, borderBox, contentBox, textColor, decorations, transform, fallbackColor, fontResolver, textGradient } = context;
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

  if (textGradient) {
    for (const run of textRuns) {
      run.textGradient = textGradient;
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
      const glyphRun = computeGlyphRun(font, run.text, run.fontSize, run.letterSpacing ?? 0);
      // Carry through any word spacing for justified lines so glyph positioning can reflect it.
      if (run.wordSpacing !== undefined && glyphRun.positions.length > 0) {
        applyWordSpacingToGlyphRun(glyphRun, run.text, run.wordSpacing);
      }

      run.glyphs = glyphRun;
    } catch (error) {
      // If font resolution or glyph mapping fails, continue without glyph data
      console.warn(`Failed to create GlyphRun for text "${run.text}": ${error}`);
    }
  }
}

/**
 * Map text to glyph IDs and compute positions with optional letter spacing.
 * Letter spacing is added between glyphs (not after the last glyph) in CSS px units.
 */
export function computeGlyphRun(font: UnifiedFont, text: string, fontSize: number, letterSpacing: number): GlyphRun {
  const glyphIds: number[] = [];
  const positions: { x: number; y: number }[] = [];
  let currentX = 0;
  const kerning = font.metrics.kerning;
  const unitsPerEm = font.metrics.metrics.unitsPerEm;
  let prevGid: number | null = null;

  for (let i = 0; i < text.length; i++) {
    const codePoint = text.codePointAt(i) ?? 0;
    const glyphId = font.metrics.cmap.getGlyphId(codePoint);

    glyphIds.push(glyphId);

    // Get advance width for this glyph
    const glyphMetric = font.metrics.glyphMetrics.get(glyphId);
    const advanceWidth = glyphMetric?.advanceWidth ?? 0;

    // Apply kerning adjustment from previous glyph if present
    if (prevGid !== null && kerning) {
      const kernAdjust = getKerningAdjustment(kerning, prevGid, glyphId);
      if (kernAdjust !== 0) {
        currentX += (kernAdjust / unitsPerEm) * fontSize;
      }
    }

    // Scale advance width to font size
    const scaledAdvance = (advanceWidth / unitsPerEm) * fontSize;

    positions.push({ x: currentX, y: 0 });
    currentX += scaledAdvance;

    // Apply letter-spacing between glyphs
    if (i < text.length - 1) {
      currentX += letterSpacing;
    }

    // Handle surrogate pairs (advance i if this was a surrogate pair)
    if (codePoint > 0xFFFF) {
      i++;
    }

    prevGid = glyphId;
  }

  return {
    font,
    glyphIds,
    positions,
    text,
    fontSize,
    width: currentX,
  };
}

export function applyWordSpacingToGlyphRun(glyphRun: GlyphRun, text: string, wordSpacing: number | undefined): void {
  // Optimization 1: Simpler truthy check covers (undefined, null, 0)
  if (!wordSpacing) {
    return;
  }

  let accumulatedSpacing = 0;
  // Optimization 2: Cache the length.
  // Accessing .length on every iteration can be slightly slower in some JS engines.
  const len = glyphRun.positions.length;

  for (let i = 0; i < len; i++) {
    if (accumulatedSpacing > 0) {
      glyphRun.positions[i].x += accumulatedSpacing;
    }

    // Optimization 3: Use charCodeAt instead of string comparison.
    // text[i] === " " creates a temporary string object for every character.
    // charCodeAt(i) === 32 compares integers, which is faster and generates no garbage.
    if (text.charCodeAt(i) === 32) {
      accumulatedSpacing += wordSpacing;
    }
  }

  if (accumulatedSpacing > 0) {
    glyphRun.width = (glyphRun.width ?? 0) + accumulatedSpacing;
  }
}

function getKerningAdjustment(map: KerningMap, left: number, right: number): number {
  const rightMap = map.get(left);
  if (!rightMap) return 0;
  return rightMap.get(right) ?? 0;
}
