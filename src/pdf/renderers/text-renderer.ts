import type { Run, TextPaintOptions } from "../types.js";
import type { FontRegistry, FontResource } from "../font/font-registry.js";
import type { PdfObjectRef } from "../primitives/pdf-document.js";
import { encodeAndEscapePdfText, escapePdfLiteral, type PdfEncodingScheme } from "../utils/encoding.js";
import { needsUnicode } from "../../text/text.js";
import { log } from "../../debug/log.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import type { ImageRenderer } from "./image-renderer.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";
import { fillColorCommand, formatNumber } from "./text-renderer-utils.js";
import { TextShadowRenderer } from "./text-shadow-renderer.js";
import { TextDecorationRenderer } from "./text-decoration-renderer.js";

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

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly fontRegistry: FontRegistry,
    imageRenderer?: ImageRenderer,
    graphicsStateManager?: GraphicsStateManager,
  ) {
    this.graphicsStateManager = graphicsStateManager;
    this.shadowRenderer = new TextShadowRenderer(coordinateTransformer, fontRegistry, imageRenderer, graphicsStateManager);
    this.decorationRenderer = new TextDecorationRenderer(coordinateTransformer, graphicsStateManager);
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
    const { scheme, encoded } = this.encodeTextPayload(before, font);

    const baselineAdjust = options.fontSizePt;

    // === diagnóstico cirúrgico: caminho de encoding ===
    log("ENCODING", "INFO", "encoding-path", {
      scheme,
      font: font.baseFont
    });

    log("PAINT","TRACE","drawText(content)", {
      before: before.length > 60 ? before.slice(0, 57) + "..." : before,
      encoded: encoded.length > 60 ? encoded.slice(0, 57) + "..." : encoded,
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
      `(${encoded}) Tj`,
      "ET",
    );
  }

  async drawTextRun(run: Run): Promise<void> {
    const font = await this.ensureFont({ fontFamily: run.fontFamily, fontWeight: run.fontWeight, fontStyle: run.fontStyle, fontVariant: run.fontVariant, text: run.text });
    const color = run.fill ?? { r: 0, g: 0, b: 0, a: 1 };
    let normalizedText = run.text;
    if (run.fontVariant === "small-caps") {
      normalizedText = normalizedText.toUpperCase();
    }
    const { scheme, encoded } = this.encodeTextPayload(normalizedText, font);

    const Tm = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const fontSizePt = this.coordinateTransformer.convertPxToPt(run.fontSize);
    const localBaseline = Tm.f - this.coordinateTransformer.pageOffsetPx;
    const y = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localBaseline);
    const x = this.coordinateTransformer.convertPxToPt(Tm.e);

    // === diagnóstico cirúrgico: caminho de encoding ===
    log("ENCODING", "INFO", "encoding-path", {
      scheme,
      font: font.baseFont
    });

    log("PAINT","TRACE","drawText(content)", {
      before: normalizedText.length > 60 ? normalizedText.slice(0, 57) + "..." : normalizedText,
      encoded: encoded.length > 60 ? encoded.slice(0, 57) + "..." : encoded,
      font: font.baseFont, size: fontSizePt
    });

    log("PAINT","DEBUG","drawing text run", {
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

    // Now draw the main text
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

    // Low-level PDF check: if the text matrix includes skew/shear components (b or c),
    // emit a lightweight PDF comment into the content stream with the matrix values.
    // This allows simple post-generation inspection of the produced PDF bytes to
    // confirm transforms were applied. Comments begin with '%' and are ignored by PDF renderers.
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
      // keep warn-and-continue: do not fail rendering for diagnostics
    }

    this.commands.push(...this.decorationRenderer.render(run, color));
  }

  private async ensureFont(options: { fontFamily?: string; fontWeight?: number; fontStyle?: string; fontVariant?: string; text?: string }): Promise<FontResource> {
    const text = options.text ?? "";
    const requiresUnicode = needsUnicode(text);
    let resource = await this.fontRegistry.ensureFontResource(options.fontFamily, options.fontWeight, options.fontStyle);

    if (requiresUnicode && resource.isBase14) {
      const fallback = await this.fontRegistry.ensureFontResource(undefined, options.fontWeight, options.fontStyle);
      if (!fallback.isBase14) {
        resource = fallback;
      }
    }

    if (!this.fonts.has(resource.resourceName)) {
      this.fonts.set(resource.resourceName, resource.ref);
    }
    return resource;
  }

  private encodeTextPayload(text: string, font: FontResource): { encoded: string; scheme: PdfEncodingScheme } {
    if (font.isBase14) {
      return { encoded: encodeAndEscapePdfText(text, "WinAnsi"), scheme: "WinAnsi" };
    }
    return { encoded: this.encodeIdentityText(text, font), scheme: "Identity-H" };
  }

  private encodeIdentityText(text: string, font: FontResource): string {
    const metrics = font.metrics;
    if (!metrics) {
      return encodeAndEscapePdfText(text, "WinAnsi");
    }
    let encoded = "";
    for (const char of text) {
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined) {
        continue;
      }
      const glyphId = metrics.cmap.getGlyphId(codePoint);
      encoded += String.fromCharCode((glyphId >> 8) & 0xff, glyphId & 0xff);
    }
    return escapePdfLiteral(encoded);
  }

  getResult(): TextRendererResult {
    return {
      commands: [...this.commands],
      fonts: new Map(this.fonts),
    };
  }

}
