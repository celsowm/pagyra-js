import { ComputedStyle } from "../../css/style.js";
import { ImageService } from "../../image/image-service.js";
import type { ImageInfo } from "../../image/types.js";
import { log } from "../../logging/debug.js";
import { decodeBase64ToUint8Array } from "../../utils/base64.js";
import { canLoadHttpResource, resolveImageSource, type ConversionContext } from "../image-converter.js";

function extractCssUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("url(") && trimmed.endsWith(")")) {
    let inner = trimmed.slice(4, -1).trim();
    if (
      (inner.startsWith("'") && inner.endsWith("'")) ||
      (inner.startsWith("\"") && inner.endsWith("\""))
    ) {
      inner = inner.slice(1, -1);
    }
    return inner;
  }
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isDataUri(value: string): boolean {
  return /^data:/i.test(value);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function loadBackgroundImage(
  cssUrl: string,
  context: ConversionContext,
): Promise<{ info: ImageInfo; resolvedSrc: string } | null> {
  const imageService = ImageService.getInstance(context.environment);
  const resolvedSrc = resolveImageSource(cssUrl, context);

  if (isHttpUrl(resolvedSrc) && !canLoadHttpResource(resolvedSrc, context)) {
    log("dom-converter", "warn", `Skipping remote background image (${resolvedSrc}); remote assets are not supported.`);
    return null;
  }

  try {
    let imageInfo: ImageInfo;
    if (isDataUri(resolvedSrc)) {
      const comma = resolvedSrc.indexOf(",");
      if (comma < 0) {
        log("dom-converter", "warn", `Unsupported data URI format for background image: ${cssUrl}`);
        return null;
      }
      const meta = resolvedSrc.substring(5, comma);
      const isBase64 = meta.endsWith(";base64");
      const payload = resolvedSrc.substring(comma + 1);
      const bytes = isBase64
        ? decodeBase64ToUint8Array(payload)
        : new TextEncoder().encode(decodeURIComponent(payload));
      const copy = bytes.slice();
      imageInfo = await imageService.decodeImage(copy.buffer);
    } else {
      imageInfo = await imageService.loadImage(resolvedSrc);
    }
    return { info: imageInfo, resolvedSrc };
  } catch (error) {
    log("dom-converter", "warn", `Failed to load background image ${cssUrl}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function hydrateBackgroundImages(style: ComputedStyle, context: ConversionContext): Promise<void> {
  if (!style.backgroundLayers || style.backgroundLayers.length === 0) {
    return;
  }

  for (const layer of style.backgroundLayers) {
    if (layer.kind !== "image") {
      continue;
    }
    if (layer.imageInfo) {
      continue;
    }
    const cssUrl = extractCssUrl(layer.url);
    if (!cssUrl) {
      continue;
    }

    const loaded = await loadBackgroundImage(cssUrl, context);
    if (!loaded) {
      continue;
    }
    layer.originalUrl = cssUrl;
    layer.resolvedUrl = loaded.resolvedSrc;
    layer.imageInfo = loaded.info;
  }
}
