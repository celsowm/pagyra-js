import type { PdfObjectRef } from "../primitives/pdf-document.js";
import { TextRenderer } from "../renderers/text-renderer.js";
import { ImageRenderer } from "../renderers/image-renderer.js";
import { ShapeRenderer } from "../renderers/shape-renderer.js";
import { GraphicsStateManager } from "../renderers/graphics-state-manager.js";
import { registerGlyphAtlasPages } from "./glyph-atlas-registrar.js";
import { partitionImageCommands } from "./image-command-partitioner.js";

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

export class ResultCombiner {
  constructor(
    private readonly textRenderer: TextRenderer,
    private readonly imageRenderer: ImageRenderer,
    private readonly shapeRenderer: ShapeRenderer,
    private readonly graphicsStateManager: GraphicsStateManager,
  ) {}

  combineResults(): PainterResult {
    const textResult = this.textRenderer.getResult();
    registerGlyphAtlasPages(this.imageRenderer);
    const imageResult = this.imageRenderer.getResult();
    const shapeResult = this.shapeRenderer.getResult();
    const graphicsStates = new Map<string, number>();
    for (const [name, alpha] of this.graphicsStateManager.getGraphicsStates()) {
      graphicsStates.set(name, alpha);
    }

    // Partition image commands: shadow rasters (drawn beneath shapes) vs others
    const shadowAliases = new Set<string>();
    for (const [, res] of imageResult.images) {
      if (res.image.src && typeof res.image.src === 'string' && res.image.src.startsWith('internal:shadow:')) {
        shadowAliases.add(res.alias);
      }
    }

    const { preShadow, post } = partitionImageCommands(imageResult.commands, shadowAliases);
    const allCommands = [...preShadow, ...shapeResult.commands, ...textResult.commands, ...post];

    // Process image resources to match the expected format
    const processedImages: PainterImageResource[] = [];
    for (const [, resource] of imageResult.images) {
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
