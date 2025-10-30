import type { Rect, Run, RenderBox, RGBA, ImageRef, Radius, TextPaintOptions } from "./types.js";
import type { LinearGradient } from "../css/parsers/gradient-parser.js";
import type { FontRegistry } from "./font/font-registry.js";
import type { PdfObjectRef } from "./primitives/pdf-document.js";
import { log } from "../debug/log.js";
import { CoordinateTransformer } from "./utils/coordinate-transformer.js";
import { TextRenderer } from "./renderers/text-renderer.js";
import { ImageRenderer } from "./renderers/image-renderer.js";
import { ShapeRenderer } from "./renderers/shape-renderer.js";
import { GraphicsStateManager } from "./renderers/graphics-state-manager.js";

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

  fillRoundedRect(rect: Rect, radii: Radius, paint: RGBA | LinearGradient | string): void {
    this.shapeRenderer.fillRoundedRect(rect, radii, paint);
  }

  fillRoundedRectDifference(outerRect: Rect, outerRadii: Radius, innerRect: Rect, innerRadii: Radius, color: RGBA): void {
    this.shapeRenderer.fillRoundedRectDifference(outerRect, outerRadii, innerRect, innerRadii, color);
  }

  fillRect(rect: Rect, paint: RGBA | LinearGradient | string): void {
    this.shapeRenderer.fillRect(rect, paint);
  }

  strokeRect(rect: Rect, color: RGBA): void {
    this.shapeRenderer.strokeRect(rect, color);
  }

  result(): PainterResult {
    const textResult = this.textRenderer.getResult();
    const imageResult = this.imageRenderer.getResult();
    const shapeResult = this.shapeRenderer.getResult();
    const graphicsStates = this.graphicsStateManager.getGraphicsStates();

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
      graphicsStates: graphicsStates,
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
