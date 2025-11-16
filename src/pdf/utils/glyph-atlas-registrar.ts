import { globalGlyphAtlas } from "../font/glyph-atlas.js";
import type { ImageRenderer } from "../renderers/image-renderer.js";

export function registerGlyphAtlasPages(imageRenderer: ImageRenderer): void {
  try {
    const pages = globalGlyphAtlas.getPages();
    if (pages && pages.length > 0) {
      imageRenderer.registerAtlasPages(pages);
    }
  } catch {
    // ignore atlas registration errors - fall back to per-glyph images
  }
}
