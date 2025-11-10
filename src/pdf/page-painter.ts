import type { Rect, Run, RGBA, ImageRef, Radius, TextPaintOptions } from "./types.js";
import type { LinearGradient, RadialGradient } from "../css/parsers/gradient-parser.js";
import type { FontRegistry } from "./font/font-registry.js";
import type { PdfObjectRef } from "./primitives/pdf-document.js";
import { CoordinateTransformer } from "./utils/coordinate-transformer.js";
import { TextRenderer } from "./renderers/text-renderer.js";
import { ImageRenderer } from "./renderers/image-renderer.js";
import { ShapeRenderer, type ShapePoint, type PathCommand } from "./renderers/shape-renderer.js";
import { GraphicsStateManager } from "./renderers/graphics-state-manager.js";
import { globalGlyphAtlas } from "./font/glyph-atlas.js";

export interface PainterResult {
  readonly content: string;
  readonly fonts: Map<string, PdfObjectRef>;
  readonly images: PainterImageResource[];
  readonly graphicsStates: Map<string, number>;
  readonly shadings: Map<string, string>;
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

export class PagePainter {
  private readonly coordinateTransformer: CoordinateTransformer;
  private readonly textRenderer: TextRenderer;
  private readonly imageRenderer: ImageRenderer;
  private readonly shapeRenderer: ShapeRenderer;
  private readonly graphicsStateManager: GraphicsStateManager;

  constructor(
    pageHeightPt: number,
    pxToPt: (value: number) => number,
    fontRegistry: FontRegistry,
    pageOffsetPx: number = 0,
  ) {
    this.coordinateTransformer = new CoordinateTransformer(pageHeightPt, pxToPt, pageOffsetPx);
    this.graphicsStateManager = new GraphicsStateManager();
    this.imageRenderer = new ImageRenderer(this.coordinateTransformer);
    this.textRenderer = new TextRenderer(this.coordinateTransformer, fontRegistry, this.imageRenderer, this.graphicsStateManager);
    this.shapeRenderer = new ShapeRenderer(this.coordinateTransformer, this.graphicsStateManager);
  }

  get pageHeightPx(): number {
    return this.coordinateTransformer.pageHeightPx;
  }

  drawBoxOutline(box: Rect, color: RGBA = { r: 0.85, g: 0.85, b: 0.85, a: 1 }): void {
    this.shapeRenderer.drawBoxOutline(box, color);
  }

  drawFilledBox(box: Rect, color: RGBA): void {
    this.shapeRenderer.drawFilledBox(box, color);
  }

  drawImage(image: ImageRef, rect: Rect): void {
    this.imageRenderer.drawImage(image, rect);
  }

  drawBackgroundImage(image: ImageRef, rect: Rect, clipRect: Rect, clipRadius: Radius): void {
    if (!clipRect || clipRect.width <= 0 || clipRect.height <= 0) {
      this.drawImage(image, rect);
      return;
    }
    const clipCommands = this.buildClipCommands(clipRect, clipRadius);
    if (!clipCommands) {
      this.drawImage(image, rect);
      return;
    }
    const resource = this.imageRenderer.registerResource(image);
    const imageMatrix = this.buildImageMatrix(rect);
    if (!imageMatrix) {
      return;
    }
    const commands = ["q", ...clipCommands, "W n", imageMatrix, `/${resource.alias} Do`, "Q"];
    this.shapeRenderer.pushRawCommands(commands);
  }

  // Draw an image immediately into the shape command stream (for shadows)
  drawShadowImage(image: ImageRef, rect: Rect): void {
    if (rect.width <= 0 || rect.height <= 0) return;
    const res = this.imageRenderer.registerResource(image);
    const widthPt = this.coordinateTransformer.convertPxToPt(rect.width);
    const heightPt = this.coordinateTransformer.convertPxToPt(rect.height);
    if (widthPt === 0 || heightPt === 0) return;
    const xPt = this.coordinateTransformer.convertPxToPt(rect.x);
    const localY = rect.y - this.coordinateTransformer.pageOffsetPx;
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY + rect.height);
    const cmds = [
      "q",
      `${formatNumber(widthPt)} 0 0 ${formatNumber(heightPt)} ${formatNumber(xPt)} ${formatNumber(yPt)} cm`,
      `/${res.alias} Do`,
      "Q",
    ];
    this.shapeRenderer.pushRawCommands(cmds);
  }

  async drawText(text: string, xPx: number, yPx: number, options: TextPaintOptions = { fontSizePt: 10 }): Promise<void> {
    await this.textRenderer.drawText(text, xPx, yPx, options);
  }

  async drawTextRun(run: Run): Promise<void> {
    await this.textRenderer.drawTextRun(run);
  }

  fillRoundedRect(rect: Rect, radii: Radius, paint: RGBA | LinearGradient | RadialGradient | string): void {
    this.shapeRenderer.fillRoundedRect(rect, radii, paint);
  }

  fillRoundedRectDifference(outerRect: Rect, outerRadii: Radius, innerRect: Rect, innerRadii: Radius, color: RGBA): void {
    this.shapeRenderer.fillRoundedRectDifference(outerRect, outerRadii, innerRect, innerRadii, color);
  }

  fillRect(rect: Rect, paint: RGBA | LinearGradient | RadialGradient | string): void {
    this.shapeRenderer.fillRect(rect, paint);
  }

  strokeRect(rect: Rect, color: RGBA): void {
    this.shapeRenderer.strokeRect(rect, color);
  }

  strokeRoundedRect(rect: Rect, radii: Radius, color: RGBA, lineWidth?: number): void {
    this.shapeRenderer.strokeRoundedRect(rect, radii, color, lineWidth);
  }

  fillPolygon(points: ShapePoint[], color: RGBA, close: boolean = true): void {
    this.shapeRenderer.fillPolygon(points, color, close);
  }

  fillPath(commands: PathCommand[], color: RGBA, options: { fillRule?: "nonzero" | "evenodd" } = {}): void {
    this.shapeRenderer.fillPath(commands, color, options);
  }

  // New: fill an arbitrary path with a gradient (linear or radial). The ShapeRenderer will
  // create a clipping path from the provided commands and paint the shading clipped to that path.
  fillPathWithGradient(commands: PathCommand[], gradient: LinearGradient | RadialGradient, options: { fillRule?: "nonzero" | "evenodd" } = {}): void {
    this.shapeRenderer.fillPathWithGradient(commands, gradient, options);
  }

  strokePolyline(
    points: ShapePoint[],
    color: RGBA,
    options: { lineWidth?: number; lineCap?: "butt" | "round" | "square"; lineJoin?: "miter" | "round" | "bevel"; close?: boolean } = {},
  ): void {
    this.shapeRenderer.strokePolyline(points, color, options);
  }

  strokePath(
    commands: PathCommand[],
    color: RGBA,
    options: { lineWidth?: number; lineCap?: "butt" | "round" | "square"; lineJoin?: "miter" | "round" | "bevel" } = {},
  ): void {
    this.shapeRenderer.strokePath(commands, color, options);
  }

  convertPxToPt(value: number): number {
    return this.coordinateTransformer.convertPxToPt(value);
  }

  beginOpacityScope(opacity: number): void {
    if (opacity >= 1) return;
    const state = this.graphicsStateManager.ensureFillAlphaState(opacity);
    this.shapeRenderer.pushRawCommands(["q", `/${state} gs`]);
  }

  endOpacityScope(opacity: number): void {
    if (opacity >= 1) return;
    this.shapeRenderer.pushRawCommands(["Q"]);
  }

  private buildImageMatrix(rect: Rect): string | null {
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const widthPt = this.coordinateTransformer.convertPxToPt(rect.width);
    const heightPt = this.coordinateTransformer.convertPxToPt(rect.height);
    if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt === 0 || heightPt === 0) {
      return null;
    }
    const xPt = this.coordinateTransformer.convertPxToPt(rect.x);
    const localY = rect.y - this.coordinateTransformer.pageOffsetPx;
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY + rect.height);
    if (!Number.isFinite(xPt) || !Number.isFinite(yPt)) {
      return null;
    }
    return `${formatNumber(widthPt)} 0 0 ${formatNumber(heightPt)} ${formatNumber(xPt)} ${formatNumber(yPt)} cm`;
  }

  private buildClipCommands(rect: Rect, radius: Radius): string[] | null {
    if (!rect) {
      return null;
    }
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return null;
    }
    if (this.isZeroRadius(radius)) {
      const pdfRect = this.rectToPdf(rect);
      if (!pdfRect) {
        return null;
      }
      return [`${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`];
    }
    return this.buildRoundedClipCommands(rect, radius);
  }

  private buildRoundedClipCommands(rect: Rect, radius: Radius): string[] | null {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return null;
    }
    const tl = radius.topLeft;
    const tr = radius.topRight;
    const br = radius.bottomRight;
    const bl = radius.bottomLeft;
    const k = 0.5522847498307936;
    const commands: string[] = [];

    const move = this.pointToPdf(rect.x + tl.x, rect.y);
    const lineTop = this.pointToPdf(rect.x + width - tr.x, rect.y);
    if (!move || !lineTop) {
      return null;
    }
    commands.push(`${move.x} ${move.y} m`);
    commands.push(`${lineTop.x} ${lineTop.y} l`);

    if (tr.x > 0 || tr.y > 0) {
      const cp1 = this.pointToPdf(rect.x + width - tr.x + k * tr.x, rect.y);
      const cp2 = this.pointToPdf(rect.x + width, rect.y + tr.y - k * tr.y);
      const end = this.pointToPdf(rect.x + width, rect.y + tr.y);
      if (!cp1 || !cp2 || !end) {
        return null;
      }
      commands.push(`${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y} c`);
    } else {
      const corner = this.pointToPdf(rect.x + width, rect.y);
      if (!corner) {
        return null;
      }
      commands.push(`${corner.x} ${corner.y} l`);
    }

    const rightLine = this.pointToPdf(rect.x + width, rect.y + height - br.y);
    if (!rightLine) {
      return null;
    }
    commands.push(`${rightLine.x} ${rightLine.y} l`);

    if (br.x > 0 || br.y > 0) {
      const cp1 = this.pointToPdf(rect.x + width, rect.y + height - br.y + k * br.y);
      const cp2 = this.pointToPdf(rect.x + width - br.x + k * br.x, rect.y + height);
      const end = this.pointToPdf(rect.x + width - br.x, rect.y + height);
      if (!cp1 || !cp2 || !end) {
        return null;
      }
      commands.push(`${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y} c`);
    } else {
      const corner = this.pointToPdf(rect.x + width, rect.y + height);
      if (!corner) {
        return null;
      }
      commands.push(`${corner.x} ${corner.y} l`);
    }

    const bottomLine = this.pointToPdf(rect.x + bl.x, rect.y + height);
    if (!bottomLine) {
      return null;
    }
    commands.push(`${bottomLine.x} ${bottomLine.y} l`);

    if (bl.x > 0 || bl.y > 0) {
      const cp1 = this.pointToPdf(rect.x + bl.x - k * bl.x, rect.y + height);
      const cp2 = this.pointToPdf(rect.x, rect.y + height - bl.y + k * bl.y);
      const end = this.pointToPdf(rect.x, rect.y + height - bl.y);
      if (!cp1 || !cp2 || !end) {
        return null;
      }
      commands.push(`${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y} c`);
    } else {
      const corner = this.pointToPdf(rect.x, rect.y + height);
      if (!corner) {
        return null;
      }
      commands.push(`${corner.x} ${corner.y} l`);
    }

    const leftLine = this.pointToPdf(rect.x, rect.y + tl.y);
    if (!leftLine) {
      return null;
    }
    commands.push(`${leftLine.x} ${leftLine.y} l`);

    if (tl.x > 0 || tl.y > 0) {
      const cp1 = this.pointToPdf(rect.x, rect.y + tl.y - k * tl.y);
      const cp2 = this.pointToPdf(rect.x + tl.x - k * tl.x, rect.y);
      const end = this.pointToPdf(rect.x + tl.x, rect.y);
      if (!cp1 || !cp2 || !end) {
        return null;
      }
      commands.push(`${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y} c`);
    } else {
      const corner = this.pointToPdf(rect.x, rect.y);
      if (!corner) {
        return null;
      }
      commands.push(`${corner.x} ${corner.y} l`);
    }

    commands.push("h");
    return commands;
  }

  private rectToPdf(rect: Rect): { x: string; y: string; width: string; height: string } | null {
    if (!rect) {
      return null;
    }
    const widthPt = this.coordinateTransformer.convertPxToPt(Math.max(rect.width, 0));
    const heightPt = this.coordinateTransformer.convertPxToPt(Math.max(rect.height, 0));
    if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt === 0 || heightPt === 0) {
      return null;
    }
    const origin = this.pointToPdf(rect.x, rect.y + rect.height);
    if (!origin) {
      return null;
    }
    return {
      x: origin.x,
      y: origin.y,
      width: formatNumber(widthPt),
      height: formatNumber(heightPt),
    };
  }

  private pointToPdf(xPx: number, yPx: number): { x: string; y: string } | null {
    if (!Number.isFinite(xPx) || !Number.isFinite(yPx)) {
      return null;
    }
    const xPt = this.coordinateTransformer.convertPxToPt(xPx);
    const localY = yPx - this.coordinateTransformer.pageOffsetPx;
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY);
    if (!Number.isFinite(xPt) || !Number.isFinite(yPt)) {
      return null;
    }
    return {
      x: formatNumber(xPt),
      y: formatNumber(yPt),
    };
  }

  private isZeroRadius(radius: Radius): boolean {
    const epsilon = 1e-6;
    return (
      Math.abs(radius.topLeft.x) <= epsilon &&
      Math.abs(radius.topLeft.y) <= epsilon &&
      Math.abs(radius.topRight.x) <= epsilon &&
      Math.abs(radius.topRight.y) <= epsilon &&
      Math.abs(radius.bottomRight.x) <= epsilon &&
      Math.abs(radius.bottomRight.y) <= epsilon &&
      Math.abs(radius.bottomLeft.x) <= epsilon &&
      Math.abs(radius.bottomLeft.y) <= epsilon
    );
  }

  result(): PainterResult {
    const textResult = this.textRenderer.getResult();
    // Ensure any atlas pages created by the glyph packer are registered as image resources
    try {
      const pages = globalGlyphAtlas.getPages();
      if (pages && pages.length > 0) {
        this.imageRenderer.registerAtlasPages(pages);
      }
    } catch (e) {
      // ignore atlas registration errors - fall back to per-glyph images
    }
    const imageResult = this.imageRenderer.getResult();
    const shapeResult = this.shapeRenderer.getResult();
    const graphicsStates = new Map<string, number>();
    for (const [name, alpha] of this.graphicsStateManager.getGraphicsStates()) {
      graphicsStates.set(name, alpha);
    }

    // Partition image commands: shadow rasters (drawn beneath shapes) vs others
    const shadowAliases = new Set<string>();
    for (const [_, res] of imageResult.images) {
      if (res.image.src && typeof res.image.src === 'string' && res.image.src.startsWith('internal:shadow:')) {
        shadowAliases.add(res.alias);
      }
    }

    const preShadowImageCmds: string[] = [];
    const postImageCmds: string[] = [];
    const cmds = imageResult.commands;
    for (let i = 0; i < cmds.length; ) {
      // Expect blocks of [q, cm, /ImX Do, Q]
      if (cmds[i] === 'q' && i + 3 < cmds.length && cmds[i + 3] === 'Q') {
        const doLine = cmds[i + 2] ?? '';
        const match = doLine.match(/^\/(\w+)\s+Do$/);
        const block = [cmds[i], cmds[i + 1] ?? '', cmds[i + 2] ?? '', cmds[i + 3] ?? ''];
        i += 4;
        if (match && shadowAliases.has(match[1])) {
          preShadowImageCmds.push(...block);
        } else {
          postImageCmds.push(...block);
        }
      } else {
        // Fallback: if structure is unexpected, push to post image commands
        postImageCmds.push(cmds[i]);
        i += 1;
      }
    }

    // Combine with correct ordering: shadow images below shapes/backgrounds, then shapes, text, then other images
    // Debug: log how many text renderer commands were produced and a short sample
    try {
      console.log("DEBUG: PagePainter.result - text commands count:", textResult.commands.length);
      if (textResult.commands.length > 0) {
        console.log("DEBUG: PagePainter.result - sample text commands:", textResult.commands.slice(0, 12));
      }
    } catch (e) {
      console.log("DEBUG: PagePainter.result - error logging text commands", e);
    }

    const allCommands = [
      ...preShadowImageCmds,
      ...shapeResult.commands,
      ...textResult.commands,
      ...postImageCmds,
    ];

    // Process image resources to match the expected format
    const processedImages: PainterImageResource[] = [];
    for (const [_, resource] of imageResult.images) {
      // Convert the image resource to the expected format
      processedImages.push({
        alias: resource.alias,
        image: {
          src: resource.image.src,
          width: resource.image.width,
          height: resource.image.height,
          format: resource.image.format,
          channels: resource.image.channels,
          bitsPerComponent: resource.image.bitsPerComponent,
          data: new Uint8Array(resource.image.data), // Convert ArrayBuffer to Uint8Array
        },
        ref: resource.ref
      });
    }

    return {
      content: allCommands.join("\n"),
      fonts: textResult.fonts,
      images: processedImages,
      graphicsStates,
      shadings: shapeResult.shadings,
    };
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
