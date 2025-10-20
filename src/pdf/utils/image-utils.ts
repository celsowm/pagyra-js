import type { LayoutNode } from "../../dom/node.js";
import type { ImageRef } from "../types.js";
import type { ImageInfo } from "../../image/types.js";

export function extractImageRef(node: LayoutNode): ImageRef | undefined {
  if (node.tagName !== "img") {
    return undefined;
  }
  const payload = node.customData?.image as
    | { originalSrc?: string; resolvedSrc?: string; info?: ImageInfo }
    | undefined;
  if (!payload?.info) {
    return undefined;
  }
  const info = payload.info;
  const src = payload.resolvedSrc ?? payload.originalSrc ?? "";
  return {
    src,
    width: info.width,
    height: info.height,
    format: info.format,
    channels: info.channels,
    bitsPerComponent: info.bitsPerChannel,
    data: info.data,
  };
}
