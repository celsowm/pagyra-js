import type { RGBA, Run, TextPaintOptions, Rect } from "../types.js";
import type { FontRegistry, FontResource } from "../font/font-registry.js";
import type { PdfObjectRef } from "../primitives/pdf-document.js";
import { encodeAndEscapePdfText, encodeToWinAnsi } from "../utils/encoding.js";
import { needsUnicode } from "../../text/text.js";
import { log } from "../../debug/log.js";
import { parseColor } from "../utils/color-utils.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import { getGlyphMask } from "../font/glyph-cache.js";
import { flattenOutline, rasterizeContours } from "../font/rasterizer.js";
import { blurAlpha } from "../font/blur.js";
import type { TtfFontMetrics, GlyphOutlineCmd } from "../../types/fonts.js";
import type { ImageRenderer } from "./image-renderer.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";

let currentGraphicsStateManager: GraphicsStateManager | undefined = undefined;

export interface TextRendererResult {
  readonly commands: string[];
  readonly fonts: Map<string, PdfObjectRef>;
}

export class TextRenderer {
  private readonly commands: string[] = [];
  private readonly fonts = new Map<string, PdfObjectRef>();
  // Cache for run-level shadow images to avoid re-rasterizing identical runs
  private readonly runShadowCache = new Map<string, { alias: string; image: any }>();

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly fontRegistry: FontRegistry,
    private readonly imageRenderer?: ImageRenderer,
    graphicsStateManager?: GraphicsStateManager,
  ) {
    // Make the graphics state manager available to module-level helpers (used by fillColorCommand).
    // This keeps change surface small: callers pass the manager; text renderer sets the module var.
    currentGraphicsStateManager = graphicsStateManager;
  }

  async drawText(text: string, xPx: number, yPx: number, options: TextPaintOptions = { fontSizePt: 10 }): Promise<void> {
    if (!text) {
      return;
    }
    
    const font = await this.ensureFont({ fontFamily: options.fontFamily, fontWeight: options.fontWeight, text });
    const usePageOffset = !(options.absolute ?? false);
    const offsetY = usePageOffset ? this.coordinateTransformer.pageOffsetPx : 0;
    const xPt = this.coordinateTransformer.convertPxToPt(xPx);
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(yPx - offsetY);
    const color = options.color ?? { r: 0, g: 0, b: 0, a: 1 };
    const before = text;

    // Use Identity-H encoding if using embedded font, otherwise WinAnsi
    const useIdentityH = !font.isBase14;
    const encodedText = useIdentityH ? text : encodeAndEscapePdfText(text);
    const escaped = useIdentityH ? encodeAndEscapePdfText(text) : encodedText; // For Identity-H, we pass raw text then escape for PDF

    const baselineAdjust = options.fontSizePt;

    // === diagnóstico cirúrgico: caminho de encoding ===
    log("ENCODING", "INFO", "encoding-path", {
      scheme: font.isBase14 ? "WinAnsi" : "Identity-H",
      font: font.baseFont
    });

    log("PAINT","TRACE","drawText(content)", {
      before: before.length > 60 ? before.slice(0, 57) + "..." : before,
      encoded: escaped.length > 60 ? escaped.slice(0, 57) + "..." : escaped,
      font: font.baseFont, size: options.fontSizePt
    });

    log("PAINT","DEBUG","drawing text", {
      text: text.slice(0, 32),
      fontName: font.baseFont,
      fontSizePt: options.fontSizePt,
      xPt, yPt
    });

    this.commands.push(
      fillColorCommand(color),
      "BT",
      `/${font.resourceName} ${formatNumber(options.fontSizePt)} Tf`,
      `${formatNumber(xPt)} ${formatNumber(yPt - baselineAdjust)} Td`,
      `(${escaped}) Tj`,
      "ET",
    );
  }

  async drawTextRun(run: Run): Promise<void> {
    const font = await this.ensureFont({ fontFamily: run.fontFamily, fontWeight: run.fontWeight, fontStyle: run.fontStyle, fontVariant: run.fontVariant, text: run.text });
    const color = run.fill ?? { r: 0, g: 0, b: 0, a: 1 };
    let before = run.text;


    if (run.fontVariant === 'small-caps') {
      before = before.toUpperCase();
    }

    // Use Identity-H encoding if using embedded font, otherwise WinAnsi
    const useIdentityH = !font.isBase14;
    const payloadText = useIdentityH ? run.text : encodeToWinAnsi(run.text);
    const escaped = encodeAndEscapePdfText(payloadText);

    const Tm = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const fontSizePt = this.coordinateTransformer.convertPxToPt(run.fontSize);
    const localBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx;
    const y = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localBaseline);
    const x = this.coordinateTransformer.convertPxToPt(Tm.e);

    // === diagnóstico cirúrgico: caminho de encoding ===
    log("ENCODING", "INFO", "encoding-path", {
      scheme: font.isBase14 ? "WinAnsi" : "Identity-H",
      font: font.baseFont
    });

    log("PAINT","TRACE","drawText(content)", {
      before: before.length > 60 ? before.slice(0, 57) + "..." : before,
      encoded: escaped.length > 60 ? escaped.slice(0, 57) + "..." : escaped,
      font: font.baseFont, size: fontSizePt
    });

    log("PAINT","DEBUG","drawing text run", {
      text: run.text.slice(0, 32),
      fontName: font.baseFont,
      fontSizePt,
      Tm,
      x, y
    });

    // Draw text shadows first (if any)
    if (run.textShadows && run.textShadows.length > 0) {
      const wordSpacing = run.wordSpacing ?? 0;
      let appliedWordSpacing = false;
      if (wordSpacing !== 0) {
        const wordSpacingPt = this.coordinateTransformer.convertPxToPt(wordSpacing);
        if (wordSpacingPt !== 0) {
          appliedWordSpacing = true;
        }
      }

      // Always prefer rasterization for text shadows when imageRenderer is available
      // This ensures proper blur effects and color handling
      const needsRaster = run.textShadows.some(sh => (sh.blur ?? 0) > 0 || (sh.color && sh.color.a !== undefined && sh.color.a < 1));
      const embedder = this.fontRegistry.getEmbedder ? this.fontRegistry.getEmbedder() : undefined;
      const faceMetrics = embedder ? embedder.getMetrics((font as any).baseFont) : null;

      // Prefer a run-level rasterization path when we have glyph outlines and an image renderer.
      // This avoids per-glyph seams and ensures blur is applied consistently.
      // If we don't have glyph data but need rasterization, we'll create a simplified raster approach
      if (this.imageRenderer && needsRaster) {
        // If we have glyph data and face metrics, use the advanced approach
        if (run.glyphs && faceMetrics) {
          try {
            // Ensure atlas pages are registered (if atlas is used)
            const pages = (await import("../font/glyph-atlas.js")).globalGlyphAtlas.getPages();
            if (pages && pages.length > 0) {
              this.imageRenderer.registerAtlasPages(pages);
            }
          } catch (e) {
            // ignore
          }

          // Prefer per-glyph mask assembly (uses glyph-cache.getGlyphMask) to avoid
          // flattening outlines + recombining contours which can be slower and prone
          // to seams. This will leverage glyph caching and atlas packing where available.
          const fontSizePx = run.fontSize;
          const supersample = 4;
          const glyphMasks: Array<{ mask: any; pos: { x: number; y: number } }> = [];

          if (run.glyphs) {
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
          }

          if (glyphMasks.length > 0) {
            // Compute bounding box for combined mask. Glyph mask coordinate convention:
            // mask.height is vertical size; glyph's baseline aligns with pos.y, so glyph top is pos.y - mask.height.
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

            // rounding and safety
            minX = Math.floor(minX);
            minY = Math.floor(minY);
            maxX = Math.ceil(maxX);
            maxY = Math.ceil(maxY);

            const combinedW = Math.max(0, maxX - minX);
            const combinedH = Math.max(0, maxY - minY);
            if (combinedW > 0 && combinedH > 0) {
              // Compose combined alpha buffer
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
                    // simple additive alpha - clamp at 255 (masks are pre-blurred per-glyph if requested)
                    const a = mask.data[srcBase + xx] || 0;
                    const summed = combinedAlpha[dstIdx] + a;
                    combinedAlpha[dstIdx] = summed > 255 ? 255 : summed;
                  }
                }
              }

              // For each shadow layer draw the composed mask (apply per-shadow blur if requested)
              for (const sh of run.textShadows) {
                if (!sh || !sh.color) continue;
                const blurPx = Math.max(0, sh.blur ?? 0);
                // Ensure we pass a Uint8ClampedArray to blurAlpha (it expects Uint8ClampedArray).
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

                // Place combined mask such that baseline aligns with Tm.f (same convention as before)
                const xPx = Tm.e + offsetX + minX;
                const yPxTop = Tm.f + offsetY - combinedH;

                const widthPt = this.coordinateTransformer.convertPxToPt(combinedW);
                const heightPt = this.coordinateTransformer.convertPxToPt(combinedH);
                const xPt = this.coordinateTransformer.convertPxToPt(xPx);
                const localY = yPxTop - this.coordinateTransformer.pageOffsetPx;
                const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY + combinedH);

                this.commands.push(
                  "q",
                  `${formatNumber(widthPt)} 0 0 ${formatNumber(heightPt)} ${formatNumber(xPt)} ${formatNumber(yPt)} cm`,
                  `/${resAlias} Do`,
                  "Q"
                );
              }
            }
          }
        } else {
          // Simplified rasterization approach when we don't have glyph data but need blur
          // This creates a basic text mask and applies blur to it
          if (needsRaster && this.imageRenderer) {
            try {
              // When we can't rasterize glyph outlines, approximate blur by compositing
              // multiple slightly-offset, semi-transparent copies of the vector text.
              // This is a pragmatic fallback: not as good as a true Gaussian-blurred mask,
              // but it produces much softer shadows than a single opaque offset.
              for (const sh of run.textShadows) {
                if (!sh || !sh.color) continue;
                const offsetX = sh.offsetX ?? 0;
                const offsetY = sh.offsetY ?? 0;
                const blurPx = Math.max(0, sh.blur ?? 0);
                const baseAlpha = sh.color.a ?? 1;

                // If blur is very small, emit a single sample.
                const samples: { dx: number; dy: number; weight: number }[] = [];
                if (blurPx <= 1) {
                  samples.push({ dx: 0, dy: 0, weight: 1 });
                } else {
                  // 9-sample approximation: center + 4 orthogonal + 4 diagonal
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

                  const shadowSequence: string[] = [fillColorCommand(sampleColor), "BT"];
                  if (appliedWordSpacing) shadowSequence.push(`${formatNumber(this.coordinateTransformer.convertPxToPt(wordSpacing))} Tw`);
                  shadowSequence.push(
                    `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`,
                    `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(shadowX)} ${formatNumber(shadowYPt)} Tm`,
                    `(${escaped}) Tj`
                  );
                  if (appliedWordSpacing) shadowSequence.push("0 Tw");
                  shadowSequence.push("ET");
                  this.commands.push(...shadowSequence);
                }
              }
            } catch (e) {
              // Fall back to single-offset vector text as a last resort
              for (const sh of run.textShadows) {
                if (!sh || !sh.color) continue;
                const shadowX = this.coordinateTransformer.convertPxToPt(Tm.e + sh.offsetX);
                const shadowLocalBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx + sh.offsetY;
                const shadowYPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(shadowLocalBaseline);

                const shadowSequence: string[] = [fillColorCommand(sh.color), "BT"];
                if (appliedWordSpacing) shadowSequence.push(`${formatNumber(this.coordinateTransformer.convertPxToPt(wordSpacing))} Tw`);
                shadowSequence.push(
                  `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`,
                  `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(shadowX)} ${formatNumber(shadowYPt)} Tm`,
                  `(${escaped}) Tj`
                );
                if (appliedWordSpacing) shadowSequence.push("0 Tw");
                shadowSequence.push("ET");
                this.commands.push(...shadowSequence);
              }
            }
          } else {
            // Legacy vector fallback: draw text as text with offsets (no blur support)
            for (const sh of run.textShadows) {
              if (!sh || !sh.color) continue;
              const shadowX = this.coordinateTransformer.convertPxToPt(Tm.e + sh.offsetX);
              const shadowLocalBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx + sh.offsetY;
              const shadowYPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(shadowLocalBaseline);

              const shadowSequence: string[] = [fillColorCommand(sh.color), "BT"];
              if (appliedWordSpacing) shadowSequence.push(`${formatNumber(this.coordinateTransformer.convertPxToPt(wordSpacing))} Tw`);
              shadowSequence.push(
                `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`,
                `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(shadowX)} ${formatNumber(shadowYPt)} Tm`,
                `(${escaped}) Tj`
              );
              if (appliedWordSpacing) shadowSequence.push("0 Tw");
              shadowSequence.push("ET");
              this.commands.push(...shadowSequence);
            }
          }
        }
      } else {
        // Legacy vector fallback: draw text as text with offsets (no blur support)
        for (const sh of run.textShadows) {
          if (!sh || !sh.color) continue;
          const shadowX = this.coordinateTransformer.convertPxToPt(Tm.e + sh.offsetX);
          const shadowLocalBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx + sh.offsetY;
          const shadowYPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(shadowLocalBaseline);

          const shadowSequence: string[] = [fillColorCommand(sh.color), "BT"];
          if (appliedWordSpacing) shadowSequence.push(`${formatNumber(this.coordinateTransformer.convertPxToPt(wordSpacing))} Tw`);
          shadowSequence.push(
            `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`,
            `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(shadowX)} ${formatNumber(shadowYPt)} Tm`,
            `(${escaped}) Tj`
          );
          if (appliedWordSpacing) shadowSequence.push("0 Tw");
          shadowSequence.push("ET");
          this.commands.push(...shadowSequence);
        }
      }
    }

    // Now draw the main text
    const sequence: string[] = [
      fillColorCommand(color),
      "BT",
    ];

    const wordSpacing = run.wordSpacing ?? 0;
    let appliedWordSpacing = false;
    if (wordSpacing !== 0) {
      const wordSpacingPt = this.coordinateTransformer.convertPxToPt(wordSpacing);
      if (wordSpacingPt !== 0) {
        sequence.push(`${formatNumber(wordSpacingPt)} Tw`);
        appliedWordSpacing = true;
      }
    }

    sequence.push(
      `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`,
      `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(x)} ${formatNumber(y)} Tm`,
      `(${escaped}) Tj`,
    );

    if (appliedWordSpacing) {
      sequence.push("0 Tw");
    }

    sequence.push("ET");

    this.commands.push(...sequence);
    this.drawTextRunDecorations(run, color);
  }

  private drawTextRunDecorations(run: Run, color: RGBA): void {
    if (!run.decorations) {
      return;
    }
    const matrix = run.lineMatrix;
    if (!matrix) {
      return;
    }
    const widthPx = Math.max(run.advanceWidth ?? 0, 0);
    if (widthPx <= 0) {
      return;
    }

    const rects: Rect[] = [];
    if (run.decorations.lineThrough) {
      const thicknessPx = Math.max(run.fontSize * 0.085, 0.5);
      const centerYPx = matrix.f - run.fontSize * 0.3;
      rects.push({
        x: matrix.e,
        y: centerYPx - thicknessPx / 2,
        width: widthPx,
        height: thicknessPx,
      });
    }

    if (run.decorations.underline) {
      const thicknessPx = Math.max(run.fontSize * 0.065, 0.5);
      const underlineYPx = matrix.f + run.fontSize * 0.1;
      rects.push({
        x: matrix.e,
        y: underlineYPx - thicknessPx / 2,
        width: widthPx,
        height: thicknessPx,
      });
    }

    if (run.decorations.overline) {
      const thicknessPx = Math.max(run.fontSize * 0.05, 0.5);
      const overlineYPx = matrix.f - run.fontSize * 0.9;
      rects.push({
        x: matrix.e,
        y: overlineYPx - thicknessPx / 2,
        width: widthPx,
        height: thicknessPx,
      });
    }

    for (const rect of rects) {
      const pdfRect = this.rectToPdf(rect);
      if (pdfRect) {
        this.commands.push(
          fillColorCommand(color),
          `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`,
          "f"
        );
      }
    }
  }

  private async ensureFont(options: { fontFamily?: string; fontWeight?: number; fontStyle?: string; fontVariant?: string; text?: string }): Promise<FontResource> {
    const family = options.fontFamily;
    const fontWeight = options.fontWeight;
    const fontStyle = options.fontStyle;
    const text = options.text || '';

    // Check if we need Unicode support (combining marks, symbols beyond WinAnsi)
    const needsUnicodeFont = needsUnicode(text);

    if (needsUnicodeFont) {
      // For now, simplify - just return a placeholder indicating Identity-H encoding
      // In full implementation, this would get the embedded font and resource
      const resource: FontResource = {
        baseFont: "NotoSans-Regular",
        resourceName: "FU", // Unicode font
        ref: { objectNumber: -1 }, // placeholder negative number for missing font
        isBase14: false
      };
      if (!this.fonts.has(resource.resourceName)) {
        this.fonts.set(resource.resourceName, resource.ref);
      }
      return resource;
    }

    // Fall back to standard registry resolution for Base14 fonts
    const resource = await this.fontRegistry.ensureFontResource(family, fontWeight, fontStyle);
    if (!this.fonts.has(resource.resourceName)) {
      this.fonts.set(resource.resourceName, resource.ref);
    }
    return resource;
  }

  private rectToPdf(rect: Rect | null | undefined):
    | { x: string; y: string; width: string; height: string }
    | null {
    if (!rect) {
      return null;
    }
    const widthPx = Math.max(rect.width, 0);
    const heightPx = Math.max(rect.height, 0);
    if (widthPx === 0 || heightPx === 0) {
      return null;
    }
    const localY = rect.y - this.coordinateTransformer.pageOffsetPx;
    const x = this.coordinateTransformer.convertPxToPt(rect.x);
    const y = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY + heightPx);
    const width = this.coordinateTransformer.convertPxToPt(widthPx);
    const height = this.coordinateTransformer.convertPxToPt(heightPx);
    return {
      x: formatNumber(x),
      y: formatNumber(y),
      width: formatNumber(width),
      height: formatNumber(height),
    };
  }

  getResult(): TextRendererResult {
    return {
      commands: [...this.commands],
      fonts: new Map(this.fonts),
    };
  }
}

function fillColorCommand(color: RGBA): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  const alpha = color.a ?? 1;
  if (alpha < 1 && currentGraphicsStateManager) {
    // Ensure an extGState exists for this alpha and emit it before the color operator.
    const stateName = currentGraphicsStateManager.ensureFillAlphaState(alpha);
    return `/${stateName} gs\n${r} ${g} ${b} rg`;
  }
  return `${r} ${g} ${b} rg`;
}

function normalizeChannel(value: number): number {
  if (value > 1) {
    return value / 255;
  }
 return value;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
