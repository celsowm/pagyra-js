import type { ImageRef, Rect } from "../types.js";
import type { PdfObjectRef } from "../primitives/pdf-document.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";

export interface ImageRendererResult {
  readonly commands: string[];
  readonly images: Map<string, { alias: string; image: ImageRef; ref?: PdfObjectRef }>;
}

export class ImageRenderer {
  private readonly commands: string[] = [];
  private readonly imageResources = new Map<string, { alias: string; image: ImageRef; ref?: PdfObjectRef }>();

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
  ) {}

  // Public helper to register an image resource and get its alias without emitting commands
  registerResource(image: ImageRef): { alias: string; image: ImageRef; ref?: PdfObjectRef } {
    return this.ensureImageResource(image);
  }

  // Register atlas pages so they can be referenced by pageIndex later.
  registerAtlasPages(pages: Array<{ width: number; height: number; data: Uint8Array }>): void {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const key = `atlas:${i}`;
      if (this.imageResources.has(key)) continue;
      const alias = `Im${this.imageResources.size}`;
      const imageRef: ImageRef = {
        src: `atlas:${i}`,
        width: page.width,
        height: page.height,
        format: "png",
        channels: 4,
        bitsPerComponent: 8,
        data: page.data.buffer as ArrayBuffer,
      };
      this.imageResources.set(key, { alias, image: imageRef });
    }
  }

  // Draw a region (sub-rectangle) from a registered atlas page into the destination rect (px coords).
  drawAtlasRegion(pageIndex: number, sx: number, sy: number, sw: number, sh: number, rect: Rect): void {
    if (rect.width <= 0 || rect.height <= 0) return;
    const key = `atlas:${pageIndex}`;
    const res = this.imageResources.get(key);
    if (!res) return;
    // Compute destination in points
    const widthPt = this.coordinateTransformer.convertPxToPt(rect.width);
    const heightPt = this.coordinateTransformer.convertPxToPt(rect.height);
    if (widthPt === 0 || heightPt === 0) return;
    const xPt = this.coordinateTransformer.convertPxToPt(rect.x);
    const localY = rect.y - this.coordinateTransformer.pageOffsetPx;
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY + rect.height);

    // Compute matrix that maps image pixel coordinates so that the sub-rect [sx,sy,sw,sh]
    // maps to the destination rectangle. Matrix: [a 0 0 d tx ty] where
    // a = widthPt / sw (pt per image-pixel), d = heightPt / sh, tx = xPt - a * sx, ty = yPt - d * sy
    const a = widthPt / sw;
    const d = heightPt / sh;
    const tx = xPt - a * sx;
    const ty = yPt - d * sy;

    const cmds = [
      "q",
      `${formatNumber(a)} 0 0 ${formatNumber(d)} ${formatNumber(tx)} ${formatNumber(ty)} cm`,
      `/${res.alias} Do`,
      "Q",
    ];
    this.commands.push(...cmds);
  }

  drawImage(image: ImageRef, rect: Rect): void {
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const resource = this.ensureImageResource(image);
    const widthPt = this.coordinateTransformer.convertPxToPt(rect.width);
    const heightPt = this.coordinateTransformer.convertPxToPt(rect.height);
    if (widthPt === 0 || heightPt === 0) {
      return;
    }
    const xPt = this.coordinateTransformer.convertPxToPt(rect.x);
    const localY = rect.y - this.coordinateTransformer.pageOffsetPx;
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY + rect.height);
    this.commands.push(
      "q",
      `${formatNumber(widthPt)} 0 0 ${formatNumber(heightPt)} ${formatNumber(xPt)} ${formatNumber(yPt)} cm`,
      `/${resource.alias} Do`,
      "Q",
    );
  }

 private ensureImageResource(image: ImageRef): { alias: string; image: ImageRef; ref?: PdfObjectRef } {
    const key = `${image.src}|${image.data.byteLength ?? 0}`;
    let resource = this.imageResources.get(key);
    if (!resource) {
      const alias = `Im${this.imageResources.size}`;
      // Note: We're storing a reference to the original image object, but for actual implementation
      // we might need to handle the ArrayBuffer differently
      resource = {
        alias,
        image: {
          ...image,
          data: image.data // This is actually an ArrayBuffer, not a Uint8Array
        },
      };
      this.imageResources.set(key, resource);
    }
    return resource;
  }

  getResult(): ImageRendererResult {
    return {
      commands: [...this.commands],
      images: new Map(this.imageResources),
    };
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
