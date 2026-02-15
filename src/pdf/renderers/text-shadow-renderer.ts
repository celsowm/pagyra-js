import type { Run, TextMatrix } from "../types.js";
import type { UnifiedFont } from "../../fonts/types.js";
import type { FontRegistry, FontResource } from "../font/font-registry.js";
import type { ImageRenderer } from "./image-renderer.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";
import type { TtfFontMetrics } from "../../types/fonts.js";
import type { BitmapMask } from "../font/rasterizer.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import { getGlyphMask } from "../font/glyph-cache.js";
import { blurAlpha } from "../font/blur.js";
import { fillColorCommand, formatNumber, normalizeChannel } from "./text-renderer-utils.js";

export interface TextShadowRenderContext {
  run: Run;
  font: FontResource;
  encoded: string;
  Tm: TextMatrix;
  fontSizePt: number;
  fontSizePx: number;
  wordSpacingPt: number;
  appliedWordSpacing: boolean;
  fontResourceName?: string;
  subset?: { gidMap: Map<number, number> };
  subsetAlias?: string;
}

export class TextShadowRenderer {
  private readonly runShadowCache = new Map<string, { alias: string; image: { src: string; width: number; height: number; format: string; channels: number; bitsPerComponent: number; data: ArrayBuffer } }>();

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly fontRegistry: FontRegistry,
    private readonly imageRenderer?: ImageRenderer,
    private readonly graphicsStateManager?: GraphicsStateManager,
  ) { }

  async render(context: TextShadowRenderContext): Promise<string[]> {
    const commands: string[] = [];
    const { run, font, encoded, Tm, fontSizePt, fontSizePx, wordSpacingPt, appliedWordSpacing, fontResourceName, subset, subsetAlias } = context;
    if (!run.textShadows || run.textShadows.length === 0) {
      return commands;
    }

    const needsRaster = run.textShadows.some(sh => (sh.blur ?? 0) > 0 || (sh.color && sh.color.a !== undefined && sh.color.a < 1));

    // Prefer glyph-run supplied metrics (add outline hook) and fall back to embedder lookup.
    const glyphMetrics = run.glyphs ? mergeMetricsWithOutline(run.glyphs.font) : null;
    const embedder = this.fontRegistry.getEmbedder ? this.fontRegistry.getEmbedder() : undefined;
    const faceMetrics = glyphMetrics ?? (embedder ? embedder.getMetrics((font as { baseFont: string }).baseFont) : null);

    const wordSpacingCmd = appliedWordSpacing ? `${formatNumber(wordSpacingPt)} Tw` : undefined;
    const resetWordSpacingCmd = appliedWordSpacing ? "0 Tw" : undefined;

    // If we have a subset, we use its alias and re-encode the text to match its CIDs
    const fontName = subsetAlias ?? fontResourceName ?? font.resourceName;
    const finalEncoded = subset ? encodeSubsetText(run, subset) : encoded;

    if (this.imageRenderer && needsRaster) {
      if (run.glyphs && faceMetrics) {
        // ... (rasterization logic stays the same)
        // Note: rasterization uses faceMetrics which doesn't trigger font realization
        // unless font.ref is accessed, but here we use font.baseFont or glyphs already in memory.

        const pages = (await import("../font/glyph-atlas.js")).globalGlyphAtlas.getPages();
        if (pages && pages.length > 0) {
          this.imageRenderer.registerAtlasPages(pages);
        }

        const supersample = 4;
        const glyphMasks: Array<{ mask: BitmapMask; pos: { x: number; y: number } }> = [];
        for (let gi = 0; gi < run.glyphs.glyphIds.length; gi++) {
          const gid = run.glyphs.glyphIds[gi];
          const pos = run.glyphs.positions[gi] ?? { x: 0, y: 0 };
          try {
            const gm = getGlyphMask(faceMetrics as TtfFontMetrics, gid, fontSizePx, supersample, 0);
            if (!gm) continue;
            glyphMasks.push({ mask: gm, pos });
          } catch {
            // ignore individual glyph failures
          }
        }

        if (glyphMasks.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          const maxBlurPx = run.textShadows.reduce((acc, sh) => Math.max(acc, Math.max(0, sh?.blur ?? 0)), 0);
          for (const item of glyphMasks) {
            const { mask, pos } = item;
            const maskOffsetX = mask.offsetX ?? 0;
            const maskOffsetY = mask.offsetY ?? 0;
            const gx0 = pos.x + maskOffsetX;
            const gy0 = pos.y + maskOffsetY;
            const gx1 = gx0 + mask.width;
            const gy1 = gy0 + mask.height;
            if (gx0 < minX) minX = gx0;
            if (gy0 < minY) minY = gy0;
            if (gx1 > maxX) maxX = gx1;
            if (gy1 > maxY) maxY = gy1;
          }
          const bleedPad = Math.ceil(maxBlurPx * 2);
          minX = Math.floor(minX - bleedPad);
          minY = Math.floor(minY - bleedPad);
          maxX = Math.ceil(maxX + bleedPad);
          maxY = Math.ceil(maxY + bleedPad);

          const combinedW = Math.max(0, maxX - minX);
          const combinedH = Math.max(0, maxY - minY);
          if (combinedW > 0 && combinedH > 0) {
            const combinedAlpha = new Uint8Array(combinedW * combinedH);
            for (const item of glyphMasks) {
              const { mask, pos } = item;
              const maskOffsetX = mask.offsetX ?? 0;
              const maskOffsetY = mask.offsetY ?? 0;
              const ox = Math.round(pos.x + maskOffsetX - minX);
              const oy = Math.round(pos.y + maskOffsetY - minY);
              for (let yy = 0; yy < mask.height; yy++) {
                const dstRow = oy + yy;
                if (dstRow < 0 || dstRow >= combinedH) continue;
                const srcRow = yy;
                const dstBase = dstRow * combinedW;
                const srcBase = srcRow * mask.width;
                for (let xx = 0; xx < mask.width; xx++) {
                  const dstIdx = dstBase + ox + xx;
                  if (dstIdx < 0 || dstIdx >= combinedAlpha.length) continue;
                  const a = mask.data[srcBase + xx] || 0;
                  const summed = combinedAlpha[dstIdx] + a;
                  combinedAlpha[dstIdx] = summed > 255 ? 255 : summed;
                }
              }
            }

            for (const sh of run.textShadows) {
              if (!sh || !sh.color) continue;
              const blurPx = Math.max(0, sh.blur ?? 0);
              const clampedCombined = combinedAlpha instanceof Uint8ClampedArray ? combinedAlpha : new Uint8ClampedArray(combinedAlpha);
              const rawAlphaBuf = blurPx > 0 ? blurAlpha(clampedCombined, combinedW, combinedH, blurPx) : clampedCombined;
              const alphaBuf = rawAlphaBuf instanceof Uint8ClampedArray ? rawAlphaBuf : new Uint8ClampedArray(rawAlphaBuf);

              const r8 = Math.round(normalizeChannel(sh.color.r) * 255);
              const g8 = Math.round(normalizeChannel(sh.color.g) * 255);
              const b8 = Math.round(normalizeChannel(sh.color.b) * 255);
              const shadowAlpha = sh.color.a ?? 1;

              const cacheKey = `${run.text}|${font.baseFont}|size:${fontSizePx}|blur:${Math.round(blurPx)}|color:${r8},${g8},${b8},${shadowAlpha}|ss:${supersample}`;
              let resAlias: string | undefined;
              const cached = this.runShadowCache.get(cacheKey);
              if (cached) {
                resAlias = cached.alias;
              } else {
                const rgba = new Uint8Array(combinedW * combinedH * 4);
                for (let i = 0, j = 0; i < alphaBuf.length; i++, j += 4) {
                  rgba[j] = r8;
                  rgba[j + 1] = g8;
                  rgba[j + 2] = b8;
                  rgba[j + 3] = Math.round(alphaBuf[i] * shadowAlpha);
                }
                const img = {
                  src: `internal:shadow:run:${(font as { resourceName: string }).resourceName}:${Math.round(Math.random() * 1e9)}`,
                  width: combinedW,
                  height: combinedH,
                  format: "png" as const,
                  channels: 4,
                  bitsPerComponent: 8,
                  data: rgba.buffer,
                };
                const res = this.imageRenderer.registerResource(img);
                resAlias = res.alias;
                this.runShadowCache.set(cacheKey, { alias: resAlias, image: img });
              }
              const offsetX = sh.offsetX ?? 0;
              const offsetY = sh.offsetY ?? 0;
              const xPx = Tm.e + offsetX + minX;
              const yPxTop = Tm.f + offsetY + minY;
              const widthPt = this.coordinateTransformer.convertPxToPt(combinedW);
              const heightPt = this.coordinateTransformer.convertPxToPt(combinedH);
              const xPt = this.coordinateTransformer.convertPxToPt(xPx);
              const localYTop = yPxTop - this.coordinateTransformer.pageOffsetPx;
              const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localYTop + combinedH);

              commands.push(
                "q",
                `${formatNumber(widthPt)} 0 0 ${formatNumber(heightPt)} ${formatNumber(xPt)} ${formatNumber(yPt)} cm`,
                `/${resAlias} Do`,
                "Q",
              );
            }
          }
        } else {
          this.appendVectorShadowLayers(commands, run, font, finalEncoded, Tm, fontSizePt, fontName, wordSpacingCmd, resetWordSpacingCmd);
        }
      } else {
        this.appendVectorShadowLayers(commands, run, font, finalEncoded, Tm, fontSizePt, fontName, wordSpacingCmd, resetWordSpacingCmd);
      }
    } else {
      this.appendVectorShadowLayers(commands, run, font, finalEncoded, Tm, fontSizePt, fontName, wordSpacingCmd, resetWordSpacingCmd);
    }

    return commands;
  }

  private appendVectorShadowLayers(
    commands: string[],
    run: Run,
    _font: FontResource,
    encoded: string,
    Tm: TextMatrix,
    fontSizePt: number,
    fontName: string,
    wordSpacingCmd?: string,
    resetWordSpacingCmd?: string,
  ): void {
    const shadows = run.textShadows ?? [];
    for (const sh of shadows) {
      if (!sh || !sh.color) continue;
      const shadowX = this.coordinateTransformer.convertPxToPt(Tm.e + (sh.offsetX ?? 0));
      const shadowLocalBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx + (sh.offsetY ?? 0);
      const shadowYPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(shadowLocalBaseline);

      const shadowSequence: string[] = ["q", fillColorCommand(sh.color, this.graphicsStateManager), "BT"];
      if (wordSpacingCmd) shadowSequence.push(wordSpacingCmd);
      shadowSequence.push(
        `/${fontName} ${formatNumber(fontSizePt)} Tf`,
        `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(shadowX)} ${formatNumber(shadowYPt)} Tm`,
        `(${encoded}) Tj`,
      );
      if (resetWordSpacingCmd) shadowSequence.push(resetWordSpacingCmd);
      shadowSequence.push("ET", "Q");
      commands.push(...shadowSequence);
    }
  }
}

function encodeSubsetText(run: Run, subset: { gidMap: Map<number, number> }): string {
  const glyphRun = run.glyphs;
  if (!glyphRun) return "";
  let encoded = "";
  for (const gid of glyphRun.glyphIds) {
    const subsetGid = subset.gidMap.get(gid) ?? 0;
    // Sequential subset CIDs are 2-bytes big-endian
    encoded += String.fromCharCode((subsetGid >> 8) & 0xff, subsetGid & 0xff);
  }

  // We need escapePdfLiteral but it's not imported here yet. 
  // We can use a local simple version or import it.
  return escapePdfLiteral(encoded);
}

function escapePdfLiteral(text: string): string {
  return text.replace(/([()\\])/g, "\\$1");
}

// Merge UnifiedFont metrics with its outline provider so glyph rasterization can work.
function mergeMetricsWithOutline(font: UnifiedFont | undefined | null): TtfFontMetrics | null {
  if (!font?.metrics || !font.program?.getGlyphOutline) {
    return null;
  }
  return {
    metrics: font.metrics.metrics,
    glyphMetrics: new Map(font.metrics.glyphMetrics),
    cmap: font.metrics.cmap,
    headBBox: font.metrics.headBBox,
    getGlyphOutline: font.program.getGlyphOutline,
  };
}
