// src/html/image-converter.ts

import { type DomEl, type CssRuleEntry } from "./css/parse-css.js";
import { LayoutNode } from "../dom/node.js";
import { ComputedStyle } from "../css/style.js";
import { computeStyleForElement } from "../css/compute-style.js";
import { ImageService } from "../image/image-service.js";
import { ImageStrategy } from "../layout/strategies/image.js";
import type { ImageInfo } from "../image/types.js";
import type { UnitParsers } from "../units/units.js";
import { log } from "../logging/debug.js";
import { decodeBase64ToUint8Array } from "../utils/base64.js";

// The ConversionContext should be defined where it's used
export interface ConversionContext {
  resourceBaseDir: string;
  assetRootDir: string;
  units: UnitParsers;
  rootFontSize: number;
  environment?: import("../environment/environment.js").Environment;
}

export function resolveImageSource(src: string, context: ConversionContext): string {
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
  if (trimmed.startsWith("/")) {
    if (context.environment?.resolveLocal) {
      const resolved = context.environment.resolveLocal(
        trimmed,
        context.assetRootDir || context.resourceBaseDir || undefined,
      );
      log('image-converter', 'debug', "resolveImageSource - resolving absolute path via resolveLocal:", {
        src,
        trimmed,
        assetRootDir: context.assetRootDir,
        resolved,
      });
      return resolved;
    }
    const resolved = (context.assetRootDir && context.environment?.pathResolve)
      ? context.environment.pathResolve(context.assetRootDir, `.${trimmed}`)
      : trimmed;
    log('image-converter', 'debug', "resolveImageSource - resolving absolute path:", { src, trimmed, assetRootDir: context.assetRootDir, resolved });
    return resolved;
  }
  if (context.environment?.resolveLocal) {
    return context.environment.resolveLocal(trimmed, context.resourceBaseDir || context.assetRootDir || undefined);
  }
  if (context.environment?.pathIsAbsolute && context.environment.pathIsAbsolute(trimmed)) {
    return trimmed;
  }
  return (context.resourceBaseDir && context.environment?.pathResolve)
    ? context.environment.pathResolve(context.resourceBaseDir, trimmed)
    : trimmed;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseHttpUrl(value?: string): URL | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url;
    }
  } catch {
    // Ignore parse failures; only interested in HTTP(S) bases.
  }
  return null;
}

function collectAllowedOrigins(context: ConversionContext): URL[] {
  const origins = new Map<string, URL>();
  const candidates = [context.assetRootDir, context.resourceBaseDir];
  for (const candidate of candidates) {
    const parsed = parseHttpUrl(candidate);
    if (parsed) {
      const key = parsed.origin;
      if (!origins.has(key)) {
        origins.set(key, parsed);
      }
    }
  }
  return Array.from(origins.values());
}

export function canLoadHttpResource(url: string, context: ConversionContext): boolean {
  if (!isHttpUrl(url)) {
    return false;
  }
  try {
    const target = new URL(url);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return false;
    }
    const allowed = collectAllowedOrigins(context);
    return allowed.some((origin) => origin.origin === target.origin);
  } catch {
    return false;
  }
}

export async function convertImageElement(
  element: DomEl,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
): Promise<LayoutNode> {
  const style = computeStyleForElement(element, cssRules, parentStyle, context.units, context.rootFontSize);
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
    const imageService = ImageService.getInstance(context.environment);
    if (isHttpUrl(resolvedSrc) && !canLoadHttpResource(resolvedSrc, context)) {
      throw new Error(`Remote images are not supported (${resolvedSrc})`);
    }
    if (resolvedSrc.startsWith("data:")) {
      const match = resolvedSrc.match(/^data:image\/(.+);base64,(.+)$/);
      if (!match) {
        throw new Error("Invalid data URI");
      }
      const bytes = decodeBase64ToUint8Array(match[2]);
      const copy = bytes.slice();
      imageInfo = await imageService.decodeImage(copy.buffer, {
        maxWidth: width,
        maxHeight: height,
      });
    } else {
      imageInfo = await imageService.loadImage(resolvedSrc, {
        maxWidth: width,
        maxHeight: height,
      });
    }

    log("render-tree", "debug", "Image loaded successfully", {
      src: srcAttr,
      resolvedSrc,
      width: imageInfo.width,
      height: imageInfo.height,
      format: imageInfo.format,
    });
  } catch (error) {
    log("render-tree", "warn", `Failed to load image: ${srcAttr}. Using placeholder.`, {
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
