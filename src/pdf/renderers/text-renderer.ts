import type { Run, TextPaintOptions, Rect } from "../types.js";
import type { FontRegistry, FontResource } from "../font/font-registry.js";
import type { PdfObjectRef } from "../primitives/pdf-document.js";
import { log } from "../../logging/debug.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import type { ImageRenderer } from "./image-renderer.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";
import { formatNumber } from "./text-renderer-utils.js";
import { TextShadowRenderer } from "./text-shadow-renderer.js";
import { TextDecorationRenderer } from "./text-decoration-renderer.js";
import { TextFontResolver } from "./text-font-resolver.js";
import { encodeTextPayload } from "./text-encoder.js";
import { drawGlyphRun } from "../utils/glyph-run-renderer.js";
import { GradientService } from "../shading/gradient-service.js";
import type { LinearGradient, RadialGradient } from "../../css/parsers/gradient-parser.js";
import { transformForRect } from "./shape-utils.js";
import type { GlyphRun } from "../../layout/text-run.js";
import type { UnifiedFont } from "../../fonts/types.js";
import type { Matrix } from "../../geometry/matrix.js";
import { svgMatrixToPdf } from "../transform-adapter.js";
import { applyWordSpacingToGlyphRun, computeGlyphRun } from "../utils/node-text-run-factory.js";

const PINK = "\x1b[38;5;205m";
const RESET_COLOR = "\x1b[0m";

export interface TextRendererResult {
  readonly commands: string[];
  readonly fonts: Map<string, PdfObjectRef>;
  readonly shadings: Map<string, string>;
  readonly patterns: Map<string, string>;
}

export class TextRenderer {
  private readonly commands: string[] = [];
  private readonly fonts = new Map<string, PdfObjectRef>();
  private readonly decorationRenderer: TextDecorationRenderer;
  private readonly shadowRenderer: TextShadowRenderer;
  private readonly graphicsStateManager?: GraphicsStateManager;
  private readonly fontResolver: TextFontResolver;
  private readonly gradientService: GradientService;
  private readonly patterns = new Map<string, string>();

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly fontRegistry: FontRegistry,
    imageRenderer?: ImageRenderer,
    graphicsStateManager?: GraphicsStateManager,
  ) {
    this.graphicsStateManager = graphicsStateManager;
    this.fontResolver = new TextFontResolver(fontRegistry);
    this.shadowRenderer = new TextShadowRenderer(coordinateTransformer, fontRegistry, imageRenderer, graphicsStateManager);
    this.decorationRenderer = new TextDecorationRenderer(coordinateTransformer, graphicsStateManager);
    this.gradientService = new GradientService(coordinateTransformer);
  }

  async drawText(text: string, xPx: number, yPx: number, options: TextPaintOptions = { fontSizePt: 10 }): Promise<void> {
    if (!text) {
      return;
    }

    const fontFamily = options.fontFamily ?? "Times New Roman";
    const fontWeight = options.fontWeight ?? 400;
    const fontStyle = options.fontStyle ?? "normal";
    const fontVariant = options.fontVariant;

    // header/footer hoje passa tamanho em pt
    const fontSizePx = this.coordinateTransformer.convertPtToPx(options.fontSizePt);

    const run: Run = {
      text,
      fontFamily,
      fontWeight,
      fontStyle,
      fontVariant,
      fontSize: fontSizePx,
      letterSpacing: 0,
      wordSpacing: 0,
      fill: options.color ?? { r: 0, g: 0, b: 0, a: 1 },
      lineMatrix: {
        a: 1, b: 0, c: 0, d: 1,
        e: xPx,
        f: yPx, // baseline em px, igual aos outros runs
      },
    };

    await this.drawTextRun(run);
  }

  async drawTextRun(run: Run): Promise<void> {
    const font = await this.fontResolver.ensureFontResource({
      fontFamily: run.fontFamily,
      fontWeight: run.fontWeight,
      fontStyle: run.fontStyle,
      fontVariant: run.fontVariant,
      text: run.text
    });

    await this.drawTextRunWithGlyphs(run, font);
  }

  private async drawTextRunWithGlyphs(run: Run, font: FontResource): Promise<void> {
    const color = run.fill ?? { r: 0, g: 0, b: 0, a: 1 };
    const fontSizePt = this.coordinateTransformer.convertPxToPt(run.fontSize);

    let glyphRun = run.glyphs;
    const needsRebuild = !glyphRun || !glyphRunMatchesFont(glyphRun, font);
    if (needsRebuild) {
      const rebuilt = computeGlyphRunForFont(run, font);
      if (rebuilt) {
        glyphRun = rebuilt;
        run.glyphs = rebuilt;
      }
    }

    if (!glyphRun) {
      log("paint", "warn", "Skipping run without glyph data", {
        text: run.text.slice(0, 32),
        fontFamily: run.fontFamily,
        fontSize: run.fontSize,
      });
      return;
    }

    log("paint", "debug", `${PINK}USING GLYPH RUN${RESET_COLOR}`, {
      text: run.text.slice(0, 64),
      glyphCount: glyphRun.glyphIds.length,
    });

    const textMatrix = buildPdfTextMatrix(run, this.coordinateTransformer);

    log("paint", "debug", "drawing text run with glyphs", {
      text: run.text.slice(0, 32),
      glyphIds: glyphRun.glyphIds.slice(0, 10),
      fontSizePt,
      matrix: textMatrix,
    });

    // Normalize text for features like small-caps (match legacy behavior for shadows)
    let normalizedText = run.text;
    if (run.fontVariant === "small-caps") {
      normalizedText = normalizedText.toUpperCase();
    }

    const { encoded } = encodeTextPayload(normalizedText, font);
    const wordSpacingPx = run.wordSpacing ?? 0;
    const wordSpacingPt = this.coordinateTransformer.convertPxToPt(wordSpacingPx);
    const appliedWordSpacing = wordSpacingPx !== 0 && wordSpacingPt !== 0;

    const subsetResource = this.fontRegistry.ensureSubsetForGlyphRun(glyphRun, font);
    this.registerSubsetFont(subsetResource.alias, subsetResource.ref);

    const gradientBackground = run.textGradient;
    if (gradientBackground && gradientBackground.rect && gradientBackground.rect.width > 0 && gradientBackground.rect.height > 0) {
      log("paint", "debug", "text run has background clip gradient", {
        text: run.text.slice(0, 32),
        rect: gradientBackground.rect,
      });
      const gradientPaint = gradientBackground.gradient;
      const isLinear = (gradientPaint as LinearGradient).type === "linear";
      const isRadial = (gradientPaint as RadialGradient).type === "radial";
      if (isLinear || isRadial) {
        const pattern = this.gradientService.createPatternFromLinearGradient(
          gradientPaint as LinearGradient,
          {
            width: gradientBackground.rect.width,
            height: gradientBackground.rect.height,
            x: gradientBackground.rect.x,
            y: gradientBackground.rect.y,
          },
        );
        this.patterns.set(pattern.patternName, pattern.dictionary);

        const usePattern: string[] = [
          "q",
          `/Pattern cs`,
          `/${pattern.patternName} scn`,
        ];
        const glyphPatternCommands = drawGlyphRun(
          glyphRun,
          subsetResource.subset,
          0,
          0,
          fontSizePt,
          color,
          this.graphicsStateManager,
          wordSpacingPt,
          { skipColor: true, tm: textMatrix },
        );
        if (glyphPatternCommands.length > 0) {
          this.commands.push(...usePattern, ...glyphPatternCommands, "Q");
          if (run.decorations) {
            this.commands.push(...this.decorationRenderer.render(run, color));
          }
          return;
        }
      }
    }

    if (run.textShadows && run.textShadows.length > 0) {
      const shadowCommands = await this.shadowRenderer.render({
        run,
        font,
        encoded,
        Tm: run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        fontSizePt,
        fontSizePx: run.fontSize,
        wordSpacingPt,
        appliedWordSpacing,
        fontResourceName: font.resourceName,
        subset: subsetResource.subset,
        subsetAlias: subsetResource.alias
      });
      this.commands.push(...shadowCommands);
    }

    const glyphCommands = drawGlyphRun(
      glyphRun,
      subsetResource.subset,
      0,
      0,
      fontSizePt,
      color,
      this.graphicsStateManager,
      wordSpacingPt,
      { tm: textMatrix }
    );
    this.commands.push(...glyphCommands);

    if (run.decorations) {
      this.commands.push(...this.decorationRenderer.render(run, color));
    }
  }

  private registerFont(font: FontResource): void {
    if (!this.fonts.has(font.resourceName)) {
      this.fonts.set(font.resourceName, font.ref);
    }
  }

  private registerSubsetFont(alias: string, ref: PdfObjectRef): void {
    // Always update to the latest reference so refreshed subsets are used.
    this.fonts.set(alias, ref);
  }

  private fillGradientRect(rect: Rect, gradient: LinearGradient | RadialGradient): string[] {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width <= 0 || height <= 0) {
      return [];
    }
    const shading =
      gradient.type === "radial"
        ? this.gradientService.createRadialGradient(gradient as RadialGradient, rect)
        : this.gradientService.createLinearGradient(gradient as LinearGradient, rect);

    return [
      "q",
      transformForRect(rect, this.coordinateTransformer, null),
      `0 0 ${formatNumber(width)} ${formatNumber(height)} re`,
      "W n",
      `/${shading.shadingName} sh`,
      "Q",
    ];
  }

  private fillPatternRect(rect: Rect): string[] {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width <= 0 || height <= 0) {
      return [];
    }
    return [
      transformForRect(rect, this.coordinateTransformer, null),
      `0 0 ${formatNumber(width)} ${formatNumber(height)} re`,
      "f",
    ];
  }

  getResult(): TextRendererResult {
    return {
      commands: [...this.commands],
      fonts: new Map(this.fonts),
      shadings: this.gradientService.getShadings(),
      patterns: new Map(this.patterns),
    };
  }
}

function buildPdfTextMatrix(run: Run, transformer: CoordinateTransformer): Matrix {
  const base = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  if (!run.lineMatrix) {
    log("paint", "debug", "Run provided without lineMatrix, using identity fallback", {
      text: run.text.slice(0, 32),
      fontFamily: run.fontFamily,
    });
  }
  const offsetPx = transformer.pageOffsetPx;

  // Normalize to page origin (top-left), removing any page offset.
  const local: Matrix = {
    a: base.a,
    b: base.b,
    c: base.c,
    d: base.d,
    e: base.e,
    f: base.f - offsetPx,
  };

  const hasLinear =
    Math.abs(local.a - 1) > 1e-6 ||
    Math.abs(local.b) > 1e-6 ||
    Math.abs(local.c) > 1e-6 ||
    Math.abs(local.d - 1) > 1e-6;

  // Fast path: no skew/rotate/scale -> just convert translation.
  if (!hasLinear) {
    return {
      a: 1, b: 0, c: 0, d: 1,
      e: transformer.convertPxToPt(local.e),
      f: transformer.pageHeightPt - transformer.convertPxToPt(local.f),
    };
  }

  // Full path: map entire matrix from CSS (y-down) to PDF (y-up), then shift to bottom-left origin.
  const pdfPx = svgMatrixToPdf(local) ?? { a: 1, b: 0, c: 0, d: 1, e: local.e, f: local.f };
  return {
    a: pdfPx.a,
    b: pdfPx.b,
    c: pdfPx.c,
    d: pdfPx.d,
    e: transformer.convertPxToPt(pdfPx.e),
    f: transformer.convertPxToPt(pdfPx.f + transformer.pageHeightPx),
  };
}

function computeGlyphRunForFont(run: Run, font: FontResource): GlyphRun | null {
  const unifiedFont = buildUnifiedFontFromResource(run, font);
  if (!unifiedFont) {
    return null;
  }
  const letterSpacing = run.letterSpacing ?? 0;
  const glyphRun = computeGlyphRun(unifiedFont, run.text, run.fontSize, letterSpacing);
  applyWordSpacingToGlyphRun(glyphRun, run.text, run.wordSpacing);
  return glyphRun;
}

function buildUnifiedFontFromResource(run: Run, font: FontResource): UnifiedFont | null {
  const metrics = font.metrics;
  if (!metrics) {
    return null;
  }
  return {
    metrics: {
      metrics: metrics.metrics,
      glyphMetrics: metrics.glyphMetrics,
      cmap: metrics.cmap,
      headBBox: metrics.headBBox,
      kerning: metrics.kerning,
    },
    program: {
      sourceFormat: "ttf",
      unitsPerEm: metrics.metrics.unitsPerEm,
      glyphCount: metrics.glyphMetrics.size,
      getGlyphOutline: metrics.getGlyphOutline,
      getRawTableData: metrics.getRawTableData,
    },
    css: {
      family: run.fontFamily,
      weight: run.fontWeight ?? 400,
      style: (run.fontStyle as "normal" | "italic") ?? "normal",
    },
  };
}

function glyphRunMatchesFont(glyphRun: GlyphRun, font: FontResource): boolean {
  if (!font.metrics) {
    return true;
  }
  const metrics = glyphRun.font?.metrics;
  if (!metrics) {
    return false;
  }
  return font.metrics.cmap === metrics.cmap && font.metrics.glyphMetrics === metrics.glyphMetrics;
}
