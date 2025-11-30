import type {
  Rect,
  Run,
  RGBA,
  ImageRef,
  Radius,
  TextPaintOptions,
  TextMatrix,
  StrokeOptions,
} from "./types.js";
import type { LinearGradient, RadialGradient } from "../css/parsers/gradient-parser.js";
import type { FontRegistry } from "./font/font-registry.js";
import type { PdfObjectRef } from "./primitives/pdf-document.js";
import { CoordinateTransformer } from "./utils/coordinate-transformer.js";
import { TextRenderer } from "./renderers/text-renderer.js";
import { ImageRenderer } from "./renderers/image-renderer.js";
import { ShapeRenderer, type ShapePoint, type PathCommand } from "./renderers/shape-renderer.js";
import { GraphicsStateManager } from "./renderers/graphics-state-manager.js";
import { ClippingPathBuilder } from "./utils/clipping-path-builder.js";
import { ImageMatrixBuilder } from "./utils/image-matrix-builder.js";
import { TransformScopeManager } from "./utils/transform-scope-manager.js";
import { ResultCombiner } from "./utils/result-combiner.js";
import { globalGlyphAtlas } from "./font/glyph-atlas.js";
import type { Environment } from "../environment/environment.js";

export interface PainterResult {
  readonly content: string;
  readonly fonts: Map<string, PdfObjectRef>;
  readonly images: PainterImageResource[];
  readonly graphicsStates: Map<string, number>;
  readonly shadings: Map<string, string>;
  readonly patterns?: Map<string, string>;
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
  private readonly clippingPathBuilder: ClippingPathBuilder;
  private readonly imageMatrixBuilder: ImageMatrixBuilder;
  private readonly transformScopeManager: TransformScopeManager;
  private readonly resultCombiner: ResultCombiner;
  private clipDepth = 0;
  readonly environment?: Environment;

  constructor(
    pageHeightPt: number,
    pxToPt: (value: number) => number,
    fontRegistry: FontRegistry,
    pageOffsetPx: number = 0,
    environment?: Environment,
  ) {
    this.coordinateTransformer = new CoordinateTransformer(pageHeightPt, pxToPt, pageOffsetPx);
    this.graphicsStateManager = new GraphicsStateManager();
    this.imageRenderer = new ImageRenderer(this.coordinateTransformer);
    this.textRenderer = new TextRenderer(this.coordinateTransformer, fontRegistry, this.imageRenderer, this.graphicsStateManager);
    this.shapeRenderer = new ShapeRenderer(this.coordinateTransformer, this.graphicsStateManager);
    this.clippingPathBuilder = new ClippingPathBuilder(this.coordinateTransformer);
    this.imageMatrixBuilder = new ImageMatrixBuilder(this.coordinateTransformer);
    this.transformScopeManager = new TransformScopeManager(this.coordinateTransformer, this.shapeRenderer);
    this.resultCombiner = new ResultCombiner(this.textRenderer, this.imageRenderer, this.shapeRenderer, this.graphicsStateManager);
    this.environment = environment;
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
    const clipCommands = this.clippingPathBuilder.buildClipCommands(clipRect, clipRadius);
    if (!clipCommands) {
      this.drawImage(image, rect);
      return;
    }
    const resource = this.imageRenderer.registerResource(image);
    const imageMatrix = this.imageMatrixBuilder.buildImageMatrix(rect);
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

  strokePolyline(points: ShapePoint[], color: RGBA, options: StrokeOptions & { close?: boolean } = {}): void {
    this.shapeRenderer.strokePolyline(points, color, options);
  }

  strokePath(commands: PathCommand[], color: RGBA, options: StrokeOptions = {}): void {
    this.shapeRenderer.strokePath(commands, color, options);
  }

  beginClipPath(commands: PathCommand[], options: { fillRule?: "nonzero" | "evenodd" } = {}): void {
    if (this.shapeRenderer.beginClipPath(commands, options)) {
      this.clipDepth++;
    }
  }

  endClipPath(): void {
    if (this.clipDepth <= 0) {
      return;
    }
    this.shapeRenderer.endClipPath();
    this.clipDepth--;
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

  beginTransformScope(transform: TextMatrix, rect: Rect): void {
    this.transformScopeManager.beginTransformScope(transform, rect);
  }

  endTransformScope(): void {
    this.transformScopeManager.endTransformScope();
  }

  result(): PainterResult {
    // Ensure any atlas pages created by the glyph packer are registered as image resources
    try {
      const pages = globalGlyphAtlas.getPages();
      if (pages && pages.length > 0) {
        this.imageRenderer.registerAtlasPages(pages);
      }
    } catch {
      // ignore atlas registration errors - fall back to per-glyph images
    }
    return this.resultCombiner.combineResults();
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
