import type { RGBA, Run, TextPaintOptions, Rect } from "../types.js";
import type { FontRegistry, FontResource } from "../font/font-registry.js";
import type { PdfObjectRef } from "../primitives/pdf-document.js";
import { encodeAndEscapePdfText, encodeToWinAnsi } from "../utils/encoding.js";
import { needsUnicode } from "../../text/text.js";
import { log } from "../../debug/log.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";

export interface TextRendererResult {
  readonly commands: string[];
  readonly fonts: Map<string, PdfObjectRef>;
}

export class TextRenderer {
  private readonly commands: string[] = [];
  private readonly fonts = new Map<string, PdfObjectRef>();

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly fontRegistry: FontRegistry,
  ) {}

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
  if (color.a !== undefined && color.a < 1) {
    // Transparency is not directly supported; ignore alpha for now.
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
