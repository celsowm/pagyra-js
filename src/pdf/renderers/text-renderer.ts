import type { Run, TextPaintOptions } from "../types.js";
import type { FontRegistry, FontResource } from "../font/font-registry.js";
import type { PdfObjectRef } from "../primitives/pdf-document.js";
import { log } from "../../debug/log.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import type { ImageRenderer } from "./image-renderer.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";
import { fillColorCommand, formatNumber } from "./text-renderer-utils.js";
import { TextShadowRenderer } from "./text-shadow-renderer.js";
import { TextDecorationRenderer } from "./text-decoration-renderer.js";
import { TextFontResolver } from "./text-font-resolver.js";
import { encodeTextPayload } from "./text-encoder.js";
import { drawGlyphRun } from "../utils/glyph-run-renderer.js";
import type { GlyphRun } from "../../layout/text-run.js";
import type { UnifiedFont } from "../../fonts/types.js";

const PINK = "\x1b[38;5;205m";
const ORANGE = "\x1b[38;5;208m";
const RESET_COLOR = "\x1b[0m";

export interface TextRendererResult {
  readonly commands: string[];
  readonly fonts: Map<string, PdfObjectRef>;
}

export class TextRenderer {
  private readonly commands: string[] = [];
  private readonly fonts = new Map<string, PdfObjectRef>();
  private readonly decorationRenderer: TextDecorationRenderer;
  private readonly shadowRenderer: TextShadowRenderer;
  private readonly graphicsStateManager?: GraphicsStateManager;
  private readonly fontResolver: TextFontResolver;

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
  }

  async drawText(text: string, xPx: number, yPx: number, options: TextPaintOptions = { fontSizePt: 10 }): Promise<void> {
    if (!text) {
      return;
    }

    const font = await this.fontResolver.ensureFontResource({ fontFamily: options.fontFamily, fontWeight: options.fontWeight, text });
    this.registerFont(font);
    const usePageOffset = !(options.absolute ?? false);
    const offsetY = usePageOffset ? this.coordinateTransformer.pageOffsetPx : 0;
    const xPt = this.coordinateTransformer.convertPxToPt(xPx);
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(yPx - offsetY);
    const color = options.color ?? { r: 0, g: 0, b: 0, a: 1 };
    const before = text;
    const { scheme, encoded } = encodeTextPayload(before, font);

    const baselineAdjust = options.fontSizePt;

    log("ENCODING", "INFO", "encoding-path", {
      scheme,
      font: font.baseFont
    });

    log("PAINT", "TRACE", "drawText(content)", {
      before: before.length > 60 ? before.slice(0, 57) + "..." : before,
      encoded: encoded.length > 60 ? encoded.slice(0, 57) + "..." : encoded,
      font: font.baseFont, size: options.fontSizePt
    });

    log("PAINT", "DEBUG", "drawing text", {
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
      `(${encoded}) Tj`,
      "ET",
    );
  }

  async drawTextRun(run: Run): Promise<void> {
    const font = await this.fontResolver.ensureFontResource({
      fontFamily: run.fontFamily,
      fontWeight: run.fontWeight,
      fontStyle: run.fontStyle,
      fontVariant: run.fontVariant,
      text: run.text
    });

    if (run.glyphs || font.metrics) {
      await this.drawTextRunWithGlyphs(run, font);
      return;
    }

    this.registerFont(font);
    await this.drawTextRunLegacy(run, font);
  }

  private async drawTextRunWithGlyphs(run: Run, font: FontResource): Promise<void> {
    const color = run.fill ?? { r: 0, g: 0, b: 0, a: 1 };
    const fontSizePt = this.coordinateTransformer.convertPxToPt(run.fontSize);

    let glyphRun = run.glyphs;
    if (!glyphRun && font.metrics) {
      glyphRun = computeGlyphRunFromText(
        font.metrics,
        run.text,
        run.fontSize,
        run.letterSpacing ?? 0,
        {
          family: run.fontFamily,
          weight: run.fontWeight ?? 400,
          style: (run.fontStyle as "normal" | "italic") ?? "normal",
        }
      );
    }

    if (!glyphRun) {
      await this.drawTextRunLegacy(run, font);
      return;
    }

    log("PAINT", "INFO", `${PINK}USING GLYPH RUN${RESET_COLOR}`, {
      text: run.text.slice(0, 64),
      glyphCount: glyphRun.glyphIds.length,
    });

    const Tm = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const localBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx;
    const y = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localBaseline);
    const x = this.coordinateTransformer.convertPxToPt(Tm.e);

    log("PAINT", "DEBUG", "drawing text run with glyphs", {
      text: run.text.slice(0, 32),
      glyphIds: glyphRun.glyphIds.slice(0, 10),
      fontSizePt,
      x, y
    });

    const subsetResource = this.fontRegistry.ensureSubsetForGlyphRun(glyphRun, font);
    this.registerSubsetFont(subsetResource.alias, subsetResource.ref);

    const glyphCommands = drawGlyphRun(glyphRun, subsetResource.subset, x, y, fontSizePt, color, this.graphicsStateManager);
    this.commands.push(...glyphCommands);

    if (run.decorations) {
      this.commands.push(...this.decorationRenderer.render(run, color));
    }
  }

  private async drawTextRunLegacy(run: Run, font: FontResource): Promise<void> {
    log("PAINT", "INFO", `${ORANGE}USING LEGACY TEXT RUN${RESET_COLOR}`, {
      text: run.text.slice(0, 64),
    });
    const color = run.fill ?? { r: 0, g: 0, b: 0, a: 1 };
    let normalizedText = run.text;
    if (run.fontVariant === "small-caps") {
      normalizedText = normalizedText.toUpperCase();
    }
    const { scheme, encoded } = encodeTextPayload(normalizedText, font);

    const Tm = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const fontSizePt = this.coordinateTransformer.convertPxToPt(run.fontSize);
    const localBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx;
    const y = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localBaseline);
    const x = this.coordinateTransformer.convertPxToPt(Tm.e);

    log("ENCODING", "INFO", "encoding-path", {
      scheme,
      font: font.baseFont
    });

    log("PAINT", "TRACE", "drawText(content)", {
      before: normalizedText.length > 60 ? normalizedText.slice(0, 57) + "..." : normalizedText,
      encoded: encoded.length > 60 ? encoded.slice(0, 57) + "..." : encoded,
      font: font.baseFont, size: fontSizePt
    });

    log("PAINT", "DEBUG", "drawing text run", {
      text: normalizedText.slice(0, 32),
      fontName: font.baseFont,
      fontSizePt,
      Tm,
      x, y
    });

    const wordSpacingPx = run.wordSpacing ?? 0;
    const wordSpacingPt = this.coordinateTransformer.convertPxToPt(wordSpacingPx);
    const appliedWordSpacing = wordSpacingPx !== 0 && wordSpacingPt !== 0;

    if (run.textShadows && run.textShadows.length > 0) {
      const shadowCommands = await this.shadowRenderer.render({
        run,
        font,
        encoded,
        Tm,
        fontSizePt,
        fontSizePx: run.fontSize,
        wordSpacingPt,
        appliedWordSpacing,
      });
      this.commands.push(...shadowCommands);
    }

    const sequence: string[] = [
      fillColorCommand(color, this.graphicsStateManager),
      "BT",
    ];

    if (appliedWordSpacing) {
      sequence.push(`${formatNumber(wordSpacingPt)} Tw`);
    }

    sequence.push(
      `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`,
      `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(x)} ${formatNumber(y)} Tm`,
      `(${encoded}) Tj`,
    );

    if (appliedWordSpacing) {
      sequence.push("0 Tw");
    }

    sequence.push("ET");

    this.commands.push(...sequence);

    try {
      if (Tm && (Tm.b !== 0 || Tm.c !== 0)) {
        const vals = [
          formatNumber(Tm.a),
          formatNumber(Tm.b),
          formatNumber(Tm.c),
          formatNumber(Tm.d),
          formatNumber(Tm.e),
          formatNumber(Tm.f),
        ].join(" ");
        this.commands.push(`%PAGYRA_TRANSFORM ${vals}`);
      }
    } catch {
      // ignore
    }

    this.commands.push(...this.decorationRenderer.render(run, color));
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

  getResult(): TextRendererResult {
    return {
      commands: [...this.commands],
      fonts: new Map(this.fonts),
    };
  }
}

function computeGlyphRunFromText(
  metrics: NonNullable<FontResource["metrics"]>,
  text: string,
  fontSize: number,
  letterSpacing: number,
  css: { family?: string; weight: number; style: "normal" | "italic" },
): GlyphRun {
  const glyphIds: number[] = [];
  const positions: { x: number; y: number }[] = [];
  const unitsPerEm = metrics.metrics.unitsPerEm;
  let x = 0;

  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)!;
    const gid = metrics.cmap.getGlyphId(cp);
    glyphIds.push(gid);
    positions.push({ x, y: 0 });
    const advanceWidth = metrics.glyphMetrics.get(gid)?.advanceWidth ?? 0;
    const advancePx = (advanceWidth / unitsPerEm) * fontSize + letterSpacing;
    x += advancePx;
    if (cp > 0xffff) i++;
  }

  const unifiedFont: UnifiedFont = {
    metrics: {
      metrics: metrics.metrics,
      glyphMetrics: metrics.glyphMetrics,
      cmap: metrics.cmap,
      headBBox: metrics.headBBox,
    },
    program: {
      sourceFormat: "ttf",
      unitsPerEm: metrics.metrics.unitsPerEm,
      glyphCount: metrics.glyphMetrics.size,
      getGlyphOutline: metrics.getGlyphOutline,
    },
    css: {
      family: css.family ?? "",
      weight: css.weight,
      style: css.style,
    },
  };

  return {
    font: unifiedFont,
    glyphIds,
    positions,
    text,
    fontSize,
    width: x,
  };
}
