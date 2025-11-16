import type { PdfObjectRef } from "../primitives/pdf-document.js";
import { TextRenderer } from "../renderers/text-renderer.js";
import { ImageRenderer } from "../renderers/image-renderer.js";
import { ShapeRenderer } from "../renderers/shape-renderer.js";
import { GraphicsStateManager } from "../renderers/graphics-state-manager.js";
import { globalGlyphAtlas } from "../font/glyph-atlas.js";

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

    // Ensure any atlas pages created by the glyph packer are registered as image resources
    try {
      const pages = globalGlyphAtlas.getPages();
      if (pages && pages.length > 0) {
        this.imageRenderer.registerAtlasPages(pages);
      }
    } catch {
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
    for (const [, res] of imageResult.images) {
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
    } catch {
      console.log("DEBUG: PagePainter.result - error logging text commands");
    }

    const allCommands = [
      ...preShadowImageCmds,
      ...shapeResult.commands,
      ...textResult.commands,
      ...postImageCmds,
    ];

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
