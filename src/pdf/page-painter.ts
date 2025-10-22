import type { Rect, Run, RenderBox, RGBA, ImageRef, Radius, TextPaintOptions } from "./types.js";
import type { FontRegistry } from "./font/font-registry.js";
import type { PdfObjectRef } from "./primitives/pdf-document.js";
import { log } from "../debug/log.js";
import { CoordinateTransformer } from "./utils/coordinate-transformer.js";
import { TextRenderer } from "./renderers/text-renderer.js";
import { ImageRenderer } from "./renderers/image-renderer.js";
import { ShapeRenderer } from "./renderers/shape-renderer.js";
import { GraphicsStateManager } from "./renderers/graphics-state-manager.js";
import { GradientService } from "./shading/gradient-service.js";

export interface PainterResult {
  readonly content: string;
  readonly fonts: Map<string, PdfObjectRef>;
  readonly images: PainterImageResource[];
  readonly graphicsStates: Map<string, number>;
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
    private readonly pageHeightPt: number,
    private readonly pxToPt: (value: number) => number,
    private readonly fontRegistry: FontRegistry,
    private readonly pageOffsetPx: number = 0,
  ) {
    this.coordinateTransformer = new CoordinateTransformer(pageHeightPt, pxToPt, pageOffsetPx);
    this.textRenderer = new TextRenderer(this.coordinateTransformer, fontRegistry);
    this.imageRenderer = new ImageRenderer(this.coordinateTransformer);
    this.shapeRenderer = new ShapeRenderer(this.coordinateTransformer);
    this.graphicsStateManager = new GraphicsStateManager();
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

  async drawText(text: string, xPx: number, yPx: number, options: TextPaintOptions = { fontSizePt: 10 }): Promise<void> {
    await this.textRenderer.drawText(text, xPx, yPx, options);
  }

  async drawTextRun(run: Run): Promise<void> {
    await this.textRenderer.drawTextRun(run);
  }

  fillRoundedRect(rect: Rect, radii: Radius, color: RGBA): void {
    this.shapeRenderer.fillRoundedRect(rect, radii, color);
  }

  fillRoundedRectDifference(outerRect: Rect, outerRadii: Radius, innerRect: Rect, innerRadii: Radius, color: RGBA): void {
    this.shapeRenderer.fillRoundedRectDifference(outerRect, outerRadii, innerRect, innerRadii, color);
  }

  fillRect(rect: Rect, color: RGBA): void {
    this.shapeRenderer.fillRect(rect, color);
  }

  strokeRect(rect: Rect, color: RGBA): void {
    this.shapeRenderer.strokeRect(rect, color);
  }

  result(): PainterResult {
    const textResult = this.textRenderer.getResult();
    const imageResult = this.imageRenderer.getResult();
    const shapeResult = this.shapeRenderer.getResult();
    const graphicsStates = this.graphicsStateManager.getGraphicsStates();

    // Combine all commands
    const allCommands = [
      ...shapeResult.commands,
      ...textResult.commands,
      ...imageResult.commands
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
      graphicsStates: graphicsStates,
    };
  }
}
