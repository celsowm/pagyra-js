import type { Rect, Run, RenderBox, RGBA, ImageRef } from "./types.js";
import type { FontRegistry, FontResource } from "./font/font-registry.js";
import type { PdfObjectRef } from "./primitives/pdf-document.js";
import { encodeAndEscapePdfText, encodeToWinAnsi } from "./utils/encoding.js";
function needsUnicode(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    // fora do Latin-1
    if (cp > 0xFF) return true;
    // combining marks (Mn) 0300–036F
    if (cp >= 0x0300 && cp <= 0x036F) return true;
  }
  // Pontuações "famosas" que não existem no WinAnsi:
  if (/[—–✓★•…€₹™©®№±×÷→←↑↓→≠≤≥§¶°]/u.test(text)) return true;
  return false;
}
import type { FontEmbedder } from "./font/embedder.js";
import { getFontForText } from "./font/font-registry.js";
import { log } from "../debug/log.js";

export interface PainterResult {
  readonly content: string;
  readonly fonts: Map<string, PdfObjectRef>;
  readonly images: PainterImageResource[];
}

export interface PainterImageResource {
  readonly alias: string;
  readonly image: {
    src: string;
    width: number;
    height: number;
    format: "jpeg" | "png" | "gif" | "webp";
    channels: number;
    bitsPerComponent: number;
    data: Uint8Array;
  };
  ref?: PdfObjectRef;
}

export interface TextPaintOptions {
  readonly fontSizePt: number;
  readonly color?: RGBA;
  readonly align?: "left" | "center" | "right";
  readonly fontFamily?: string;
  readonly fontWeight?: number;
  readonly absolute?: boolean;
}

export class PagePainter {
  private readonly commands: string[] = [];
  private readonly fonts = new Map<string, PdfObjectRef>();
  private readonly imageResources = new Map<string, PainterImageResource>();
  private ptToPxFactor?: number;

  constructor(
    private readonly pageHeightPt: number,
    private readonly pxToPt: (value: number) => number,
    private readonly fontRegistry: FontRegistry,
    private readonly pageOffsetPx: number = 0,
  ) {}

  get pageHeightPx(): number {
    return this.ptToPx(this.pageHeightPt);
  }

  drawBoxOutline(box: RenderBox, color: RGBA = { r: 0.85, g: 0.85, b: 0.85, a: 1 }): void {
    this.strokeRect(box.borderBox, color);
  }

  drawFilledBox(box: RenderBox, color: RGBA): void {
    this.fillRect(box.borderBox, color);
  }

  drawImage(image: ImageRef, rect: Rect): void {
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const resource = this.ensureImageResource(image);
    const widthPt = this.pxToPt(rect.width);
    const heightPt = this.pxToPt(rect.height);
    if (widthPt === 0 || heightPt === 0) {
      return;
    }
    const xPt = this.pxToPt(rect.x);
    const localY = rect.y - this.pageOffsetPx;
    const yPt = this.pageHeightPt - this.pxToPt(localY + rect.height);
    this.commands.push(
      "q",
      `${formatNumber(widthPt)} 0 0 ${formatNumber(heightPt)} ${formatNumber(xPt)} ${formatNumber(yPt)} cm`,
      `/${resource.alias} Do`,
      "Q",
    );
  }

  async drawText(text: string, xPx: number, yPx: number, options: TextPaintOptions = { fontSizePt: 10 }): Promise<void> {
    if (!text) {
      return;
    }
    const font = await this.ensureFont({ fontFamily: options.fontFamily, fontWeight: options.fontWeight, text });
    const usePageOffset = !(options.absolute ?? false);
    const offsetY = usePageOffset ? this.pageOffsetPx : 0;
    const xPt = this.pxToPt(xPx);
    const yPt = this.pageHeightPt - this.pxToPt(yPx - offsetY);
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
    const font = await this.ensureFont({ fontFamily: run.fontFamily, fontWeight: run.fontWeight, text: run.text });
    const color = run.fill ?? { r: 0, g: 0, b: 0, a: 1 };
    const before = run.text;

    // Use Identity-H encoding if using embedded font, otherwise WinAnsi
    const useIdentityH = !font.isBase14;
    const payloadText = useIdentityH ? run.text : encodeToWinAnsi(run.text);
    const escaped = encodeAndEscapePdfText(payloadText);

    const Tm = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const fontSizePt = this.pxToPt(run.fontSize);
    const localBaseline = Tm.f - this.pageOffsetPx;
    const y = this.pageHeightPt - this.pxToPt(localBaseline);
    const x = this.pxToPt(Tm.e);

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
      const wordSpacingPt = this.pxToPt(wordSpacing);
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
  }

  result(): PainterResult {
    return {
      content: this.commands.join("\n"),
      fonts: this.fonts,
      images: Array.from(this.imageResources.values()),
    };
  }

  fillRect(rect: Rect, color: RGBA): void {
    const pdfRect = this.rectToPdf(rect);
    if (!pdfRect) {
      return;
    }
    this.commands.push(fillColorCommand(color), `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "f");
  }

  strokeRect(rect: Rect, color: RGBA): void {
    const pdfRect = this.rectToPdf(rect);
    if (!pdfRect) {
      return;
    }
    this.commands.push(strokeColorCommand(color), `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "S");
  }

  private async ensureFont(options: { fontFamily?: string; fontWeight?: number; text?: string }): Promise<FontResource> {
    const family = options.fontFamily;
    const fontWeight = options.fontWeight;
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
    const resource = await this.fontRegistry.ensureFontResource(family, fontWeight);
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
    const localY = rect.y - this.pageOffsetPx;
    const x = this.pxToPt(rect.x);
    const y = this.pageHeightPt - this.pxToPt(localY + heightPx);
    const width = this.pxToPt(widthPx);
    const height = this.pxToPt(heightPx);
    return {
      x: formatNumber(x),
      y: formatNumber(y),
      width: formatNumber(width),
      height: formatNumber(height),
    };
  }

  private ptToPx(value: number): number {
    if (!this.ptToPxFactor) {
      const factor = this.pxToPt(1);
      this.ptToPxFactor = factor === 0 ? 0 : 1 / factor;
    }
    return value * (this.ptToPxFactor ?? 0);
  }

  private ensureImageResource(image: ImageRef): PainterImageResource {
    const key = `${image.src}|${image.data.byteLength ?? 0}`;
    let resource = this.imageResources.get(key);
    if (!resource) {
      const alias = `Im${this.imageResources.size}`;
      const view = new Uint8Array(image.data);
      resource = {
        alias,
        image: {
          src: image.src,
          width: image.width,
          height: image.height,
          format: image.format,
          channels: image.channels,
          bitsPerComponent: image.bitsPerComponent,
          data: view.slice(),
        },
      };
      this.imageResources.set(key, resource);
    }
    return resource;
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

function strokeColorCommand(color: RGBA): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  return `${r} ${g} ${b} RG`;
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
