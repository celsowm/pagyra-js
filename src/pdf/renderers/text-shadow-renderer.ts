import type { Run, TextMatrix } from "../types.js";
import type { FontRegistry, FontResource } from "../font/font-registry.js";
import type { ImageRenderer } from "./image-renderer.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";
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
}

export class TextShadowRenderer {
  private readonly runShadowCache = new Map<string, { alias: string; image: any }>();

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly fontRegistry: FontRegistry,
    private readonly imageRenderer?: ImageRenderer,
    private readonly graphicsStateManager?: GraphicsStateManager,
  ) {}

  async render(context: TextShadowRenderContext): Promise<string[]> {
    const commands: string[] = [];
    const { run, font, encoded, Tm, fontSizePt, fontSizePx, wordSpacingPt, appliedWordSpacing } = context;
    if (!run.textShadows || run.textShadows.length === 0) {
      return commands;
    }

    const needsRaster = run.textShadows.some(sh => (sh.blur ?? 0) > 0 || (sh.color && sh.color.a !== undefined && sh.color.a < 1));
    const embedder = this.fontRegistry.getEmbedder ? this.fontRegistry.getEmbedder() : undefined;
    const faceMetrics = embedder ? embedder.getMetrics((font as any).baseFont) : null;

    const wordSpacingCmd = appliedWordSpacing ? `${formatNumber(wordSpacingPt)} Tw` : undefined;
    const resetWordSpacingCmd = appliedWordSpacing ? "0 Tw" : undefined;

    if (this.imageRenderer && needsRaster) {
      if (run.glyphs && faceMetrics) {
        try {
          const pages = (await import("../font/glyph-atlas.js")).globalGlyphAtlas.getPages();
          if (pages && pages.length > 0) {
            this.imageRenderer.registerAtlasPages(pages);
          }
        } catch {
          // ignore
        }

        const supersample = 4;
        const glyphMasks: Array<{ mask: any; pos: { x: number; y: number } }> = [];
        for (let gi = 0; gi < run.glyphs.glyphIds.length; gi++) {
          const gid = run.glyphs.glyphIds[gi];
          const pos = run.glyphs.positions[gi] ?? { x: 0, y: 0 };
          try {
            const gm = getGlyphMask(faceMetrics as any, gid, fontSizePx, supersample, 0);
            if (!gm) continue;
            glyphMasks.push({ mask: gm, pos });
          } catch {
            // ignore individual glyph failures
          }
        }

        if (glyphMasks.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const item of glyphMasks) {
            const { mask, pos } = item;
            const gx0 = pos.x;
            const gy0 = pos.y - mask.height;
            const gx1 = pos.x + mask.width;
            const gy1 = pos.y;
            if (gx0 < minX) minX = gx0;
            if (gy0 < minY) minY = gy0;
            if (gx1 > maxX) maxX = gx1;
            if (gy1 > maxY) maxY = gy1;
          }
          minX = Math.floor(minX);
          minY = Math.floor(minY);
          maxX = Math.ceil(maxX);
          maxY = Math.ceil(maxY);

          const combinedW = Math.max(0, maxX - minX);
          const combinedH = Math.max(0, maxY - minY);
          if (combinedW > 0 && combinedH > 0) {
            const combinedAlpha = new Uint8Array(combinedW * combinedH);
            for (const item of glyphMasks) {
              const { mask, pos } = item;
              const ox = Math.round(pos.x - minX);
              const oy = Math.round(pos.y - mask.height - minY);
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
              if (!sh || !sh.color) {
                continue;
              }
              const blurPx = Math.max(0, sh.blur ?? 0);
              const clampedCombined = combinedAlpha instanceof Uint8ClampedArray ? combinedAlpha : new Uint8ClampedArray(combinedAlpha);
              const rawAlphaBuf = blurPx > 0 ? blurAlpha(clampedCombined, combinedW, combinedH, blurPx) : clampedCombined;
              const alphaBuf = rawAlphaBuf instanceof Uint8ClampedArray ? rawAlphaBuf : new Uint8ClampedArray(rawAlphaBuf);

              const r8 = Math.round(normalizeChannel(sh.color.r) * 255);
              const g8 = Math.round(normalizeChannel(sh.color.g) * 255);
              const b8 = Math.round(normalizeChannel(sh.color.b) * 255);
              const shadowAlpha = sh.color.a ?? 1;

              const cacheKey = `${run.text}|${(font as any).baseFont}|size:${fontSizePx}|blur:${Math.round(blurPx)}|color:${r8},${g8},${b8},${shadowAlpha}|ss:${supersample}`;
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
                const img: any = {
                  src: `internal:shadow:run:${(font as any).resourceName}:${Math.round(Math.random() * 1e9)}`,
                  width: combinedW,
                  height: combinedH,
                  format: "png",
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
              const yPxTop = Tm.f + offsetY - combinedH;
              const widthPt = this.coordinateTransformer.convertPxToPt(combinedW);
              const heightPt = this.coordinateTransformer.convertPxToPt(combinedH);
              const xPt = this.coordinateTransformer.convertPxToPt(xPx);
              const localY = yPxTop - this.coordinateTransformer.pageOffsetPx;
              const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY + combinedH);

              commands.push(
                "q",
                `${formatNumber(widthPt)} 0 0 ${formatNumber(heightPt)} ${formatNumber(xPt)} ${formatNumber(yPt)} cm`,
                `/${resAlias} Do`,
                "Q",
              );
            }
          }
        }
      } else {
        if (needsRaster && this.imageRenderer) {
          try {
            for (const sh of run.textShadows) {
              if (!sh || !sh.color) continue;
              const offsetX = sh.offsetX ?? 0;
              const offsetY = sh.offsetY ?? 0;
              const blurPx = Math.max(0, sh.blur ?? 0);
              const baseAlpha = sh.color.a ?? 1;

              const samples: { dx: number; dy: number; weight: number }[] = [];
              if (blurPx <= 1) {
                samples.push({ dx: 0, dy: 0, weight: 1 });
              } else {
                const centerW = 0.38;
                const orthoW = 0.12;
                const diagW = (1 - (centerW + 4 * orthoW)) / 4;
                const radius = blurPx / 2;
                samples.push({ dx: 0, dy: 0, weight: centerW });
                samples.push({ dx: -radius, dy: 0, weight: orthoW });
                samples.push({ dx: radius, dy: 0, weight: orthoW });
                samples.push({ dx: 0, dy: -radius, weight: orthoW });
                samples.push({ dx: 0, dy: radius, weight: orthoW });
                samples.push({ dx: -radius, dy: -radius, weight: diagW });
                samples.push({ dx: radius, dy: -radius, weight: diagW });
                samples.push({ dx: -radius, dy: radius, weight: diagW });
                samples.push({ dx: radius, dy: radius, weight: diagW });
              }

              for (const s of samples) {
                const sx = s.dx;
                const sy = s.dy;
                const sampleAlpha = baseAlpha * s.weight;
                const sampleColor = { r: sh.color.r, g: sh.color.g, b: sh.color.b, a: sampleAlpha };

                const shadowX = this.coordinateTransformer.convertPxToPt(Tm.e + offsetX + sx);
                const shadowLocalBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx + offsetY + sy;
                const shadowYPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(shadowLocalBaseline);

                const shadowSequence: string[] = ["q", fillColorCommand(sampleColor, this.graphicsStateManager), "BT"];
                if (wordSpacingCmd) shadowSequence.push(wordSpacingCmd);
                shadowSequence.push(
                  `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`,
                  `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(shadowX)} ${formatNumber(shadowYPt)} Tm`,
                  `(${encoded}) Tj`,
                );
                if (resetWordSpacingCmd) shadowSequence.push(resetWordSpacingCmd);
                shadowSequence.push("ET", "Q");
                commands.push(...shadowSequence);
              }
            }
          } catch {
            this.appendVectorShadowLayers(commands, run, font, encoded, Tm, fontSizePt, wordSpacingCmd, resetWordSpacingCmd);
          }
        } else {
          this.appendVectorShadowLayers(commands, run, font, encoded, Tm, fontSizePt, wordSpacingCmd, resetWordSpacingCmd);
        }
      }
    } else {
      this.appendVectorShadowLayers(commands, run, font, encoded, Tm, fontSizePt, wordSpacingCmd, resetWordSpacingCmd);
    }

    return commands;
  }

  private appendVectorShadowLayers(
    commands: string[],
    run: Run,
    font: FontResource,
    encoded: string,
    Tm: TextMatrix,
    fontSizePt: number,
    wordSpacingCmd?: string,
    resetWordSpacingCmd?: string,
  ): void {
    const shadows = run.textShadows ?? [];
    for (const sh of shadows) {
      if (!sh || !sh.color) {
        continue;
      }
      const shadowX = this.coordinateTransformer.convertPxToPt(Tm.e + (sh.offsetX ?? 0));
      const shadowLocalBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx + (sh.offsetY ?? 0);
      const shadowYPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(shadowLocalBaseline);

      const shadowSequence: string[] = ["q", fillColorCommand(sh.color, this.graphicsStateManager), "BT"];
      if (wordSpacingCmd) shadowSequence.push(wordSpacingCmd);
      shadowSequence.push(
        `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`,
        `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(shadowX)} ${formatNumber(shadowYPt)} Tm`,
        `(${encoded}) Tj`,
      );
      if (resetWordSpacingCmd) shadowSequence.push(resetWordSpacingCmd);
      shadowSequence.push("ET", "Q");
      commands.push(...shadowSequence);
    }
  }
}
