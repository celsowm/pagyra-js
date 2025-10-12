import type { Rect, Run, RenderBox, RGBA } from "./types.js";
import type { FontRegistry, FontResource } from "./font/font-registry.js";
import type { PdfObjectRef } from "./primitives/pdf-document.js";
import { encodeAndEscapePdfText } from "./utils/encoding.js";

export interface PainterResult {
  readonly content: string;
  readonly fonts: Map<string, PdfObjectRef>;
}

export interface TextPaintOptions {
  readonly fontSizePt: number;
  readonly color?: RGBA;
  readonly align?: "left" | "center" | "right";
  readonly fontFamily?: string;
}

export class PagePainter {
  private readonly commands: string[] = [];
  private readonly fonts = new Map<string, PdfObjectRef>();
  private ptToPxFactor?: number;

  constructor(
    private readonly pageHeightPt: number,
    private readonly pxToPt: (value: number) => number,
    private readonly fontRegistry: FontRegistry,
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

  drawText(text: string, xPx: number, yPx: number, options: TextPaintOptions = { fontSizePt: 10 }): void {
    if (!text) {
      return;
    }
    const font = this.ensureFont({ fontFamily: options.fontFamily });
    const xPt = this.pxToPt(xPx);
    const yPt = this.pageHeightPt - this.pxToPt(yPx);
    const color = options.color ?? { r: 0, g: 0, b: 0, a: 1 };
    const escaped = encodeAndEscapePdfText(text);
    const baselineAdjust = options.fontSizePt;

    this.commands.push(
      fillColorCommand(color),
      "BT",
      `/${font.resourceName} ${formatNumber(options.fontSizePt)} Tf`,
      `${formatNumber(xPt)} ${formatNumber(yPt - baselineAdjust)} Td`,
      `(${escaped}) Tj`,
      "ET",
    );
  }

  drawTextRun(run: Run): void {
    const font = this.ensureFont({ fontFamily: run.fontFamily });
    const color = run.fill ?? { r: 0, g: 0, b: 0, a: 1 };
    const escaped = encodeAndEscapePdfText(run.text);
    const Tm = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const fontSizePt = this.pxToPt(run.fontSize);
    const y = this.pageHeightPt - this.pxToPt(Tm.f);
    const x = this.pxToPt(Tm.e);

    this.commands.push(
      fillColorCommand(color),
      "BT",
      `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`,
      `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(x)} ${formatNumber(y)} Tm`,
      `(${escaped}) Tj`,
      "ET",
    );
  }

  result(): PainterResult {
    return {
      content: this.commands.join("\n"),
      fonts: this.fonts,
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

  private ensureFont(options: { fontFamily?: string }): FontResource {
    const family = options.fontFamily;
    const resource = this.fontRegistry.ensureFontResource(family);
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
    const x = this.pxToPt(rect.x);
    const y = this.pageHeightPt - this.pxToPt(rect.y + heightPx);
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
