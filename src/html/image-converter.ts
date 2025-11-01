// src/html/image-converter.ts

import path from "node:path";
import { type DomEl, type CssRuleEntry } from "./css/parse-css.js";
import { LayoutNode } from "../dom/node.js";
import { ComputedStyle } from "../css/style.js";
import { computeStyleForElement } from "../css/compute-style.js";
import { ImageService } from "../image/image-service.js";
import { ImageStrategy } from "../layout/strategies/image.js";
import type { ImageInfo } from "../image/types.js";
import type { UnitParsers } from "../units/units.js";
import { log } from "../debug/log.js";

// The ConversionContext should be defined where it's used
export interface ConversionContext {
  resourceBaseDir: string;
  assetRootDir: string;
  units: UnitParsers;
}

function resolveImageSource(src: string, context: ConversionContext): string {
  const trimmed = src.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^data:/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === "file:") {
      return url.href;
    }
    return url.href;
  } catch {
    // Not an absolute URL, fall through to filesystem resolution
  }
  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return path.resolve(context.assetRootDir, `.${trimmed}`);
  }
  return path.resolve(context.resourceBaseDir, trimmed);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function convertImageElement(
  element: DomEl,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
): Promise<LayoutNode> {
  const style = computeStyleForElement(element, cssRules, parentStyle, context.units);
  // SVG <image> elements commonly use 'href' or 'xlink:href'; HTML <img> uses 'src'.
  const rawSrc = element.getAttribute("href") ?? element.getAttribute("xlink:href") ?? element.getAttribute("src") ?? "";
  const srcAttr = rawSrc?.trim() ?? "";

  const widthAttr = element.getAttribute("width");
  const heightAttr = element.getAttribute("height");
  const width = widthAttr ? Number.parseFloat(widthAttr) || undefined : undefined;
  const height = heightAttr ? Number.parseFloat(heightAttr) || undefined : undefined;

  if (!srcAttr) {
    const placeholder = new LayoutNode(style, [], { tagName: "img" });
    placeholder.intrinsicInlineSize = width ?? 100;
    placeholder.intrinsicBlockSize = height ?? 100;
    return placeholder;
  }

  const resolvedSrc = resolveImageSource(srcAttr, context);

  let imageInfo: ImageInfo;
  try {
    const imageService = ImageService.getInstance();
    if (isHttpUrl(resolvedSrc)) {
      throw new Error(`Remote images are not supported (${resolvedSrc})`);
    }
    if (resolvedSrc.startsWith("data:")) {
      const match = resolvedSrc.match(/^data:image\/(.+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid data URI");
      }
      const buffer = Buffer.from(match[2], "base64");
      imageInfo = await imageService.decodeImage(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), {
        maxWidth: width,
        maxHeight: height,
      });
    } else {
      imageInfo = await imageService.loadImage(resolvedSrc, {
        maxWidth: width,
        maxHeight: height,
      });
    }

    log("RENDER_TREE", "DEBUG", "Image loaded successfully", {
      src: srcAttr,
      resolvedSrc,
      width: imageInfo.width,
      height: imageInfo.height,
      format: imageInfo.format,
    });
  } catch (error) {
    log("RENDER_TREE", "WARN", `Failed to load image: ${srcAttr}. Using placeholder.`, {
      resolvedSrc,
      error: error instanceof Error ? error.message : String(error),
    });
    const placeholder = new LayoutNode(style, [], { tagName: "img" });
    placeholder.intrinsicInlineSize = width ?? 100;
    placeholder.intrinsicBlockSize = height ?? 100;
    return placeholder;
  }

  const layoutNode = new LayoutNode(style, [], {
    tagName: "img",
    customData: {
      image: {
        originalSrc: srcAttr,
        resolvedSrc,
        info: imageInfo,
      },
    },
  });

  layoutNode.intrinsicInlineSize = imageInfo.width;
  layoutNode.intrinsicBlockSize = imageInfo.height;

  ImageStrategy.processImage(layoutNode, imageInfo);

  if (width && height) {
    layoutNode.intrinsicInlineSize = width;
    layoutNode.intrinsicBlockSize = height;
  } else if (width) {
    layoutNode.intrinsicInlineSize = width;
    layoutNode.intrinsicBlockSize = Math.round((imageInfo.height / imageInfo.width) * width);
  } else if (height) {
    layoutNode.intrinsicBlockSize = height;
    layoutNode.intrinsicInlineSize = Math.round((imageInfo.width / imageInfo.height) * height);
  }

  return layoutNode;
}
