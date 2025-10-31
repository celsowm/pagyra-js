import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";
import { resolveLength, isAutoLength } from "../../css/length.js";
import type { ComputedStyle } from "../../css/style.js";
import type { ImageInfo } from "../../image/types.js";
import { containingBlock, horizontalNonContent, horizontalMargin } from "../utils/node-math.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";

/**
 * Image strategy following SOLID principles:
 * - Single Responsibility: Handles image layout and sizing
 * - Open/Closed: Extensible for different image types
 * - Dependency Inversion: Depends on abstractions
 */
export class ImageStrategy {
  /**
   * Processes an image element and sets up its intrinsic dimensions
   */
  public static processImage(node: LayoutNode, imageInfo: ImageInfo): void {
    // Set intrinsic dimensions from the image
    node.intrinsicInlineSize = imageInfo.width;
    node.intrinsicBlockSize = imageInfo.height;
    
    // Set default display properties for images
    if (!node.style.display || node.style.display === Display.Inline) {
      node.style.display = Display.InlineBlock;
    }
    
    // Handle image sizing
    this.setupImageSizing(node, imageInfo);
  }

  /**
   * Sets up image sizing based on CSS properties
   */
  private static setupImageSizing(node: LayoutNode, imageInfo: ImageInfo): void {
    // If width is explicitly set, calculate proportional height
    if (node.style.width !== undefined && typeof node.style.width === 'number' && node.style.width > 0) {
      const specifiedWidth = resolveLength(node.style.width, node.intrinsicInlineSize!, { auto: "zero" });
      const scale = specifiedWidth / node.intrinsicInlineSize!;
      node.intrinsicBlockSize = Math.round(node.intrinsicBlockSize! * scale);
    }
    // If height is explicitly set, calculate proportional width
    else if (node.style.height !== undefined && typeof node.style.height === 'number' && node.style.height > 0) {
      const specifiedHeight = resolveLength(node.style.height, node.intrinsicBlockSize!, { auto: "zero" });
      const scale = specifiedHeight / node.intrinsicBlockSize!;
      node.intrinsicInlineSize = Math.round(node.intrinsicInlineSize! * scale);
    }
    // Handle max-width constraints
    else if (node.style.maxWidth !== undefined && typeof node.style.maxWidth === 'number') {
      const maxWidth = resolveLength(node.style.maxWidth, node.intrinsicInlineSize!, { auto: "zero" });
      if (maxWidth < node.intrinsicInlineSize!) {
        const scale = maxWidth / node.intrinsicInlineSize!;
        node.intrinsicInlineSize = maxWidth;
        node.intrinsicBlockSize = Math.round(node.intrinsicBlockSize! * scale);
      }
    }
  }

  /**
   * Determines if an element should be treated as an image
  */
  public static isImageElement(element: LayoutNode): boolean {
    if (!element.tagName) {
      return Boolean(element.textContent && element.textContent.includes("data:image"));
    }
    const tag = element.tagName.toLowerCase();
    if (tag === "img" || tag === "picture") {
      return true;
    }
    return Boolean(element.textContent && element.textContent.includes("data:image"));
  }
}

/**
 * Determines the object-fit behavior for images
 */
export function determineObjectFit(node: LayoutNode): 'contain' | 'cover' | 'fill' | 'none' | 'scale-down' {
  const style = node.style;
  
  // Check for explicit object-fit property
  if (style.objectFit) {
    return style.objectFit;
  }
  
  // Default behavior based on CSS specification
  if (style.width && style.height) {
    return 'fill';
  }

  // Check background layers for size information
  if (style.backgroundLayers) {
    for (let i = style.backgroundLayers.length - 1; i >= 0; i--) {
      const layer = style.backgroundLayers[i];
      if (layer.kind === 'image' && layer.size) {
        if (layer.size === 'contain') return 'contain';
        if (layer.size === 'cover') return 'cover';
      }
    }
  }
  
  return 'contain';
}

/**
 * Calculates image position for object-fit positioning
 */
export function calculateImagePosition(
  node: LayoutNode,
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
  objectFit: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
): { x: number; y: number; width: number; height: number } {
  let x = 0;
  let y = 0;
  let width = imageWidth;
  let height = imageHeight;

  switch (objectFit) {
    case 'contain':
      const containScale = Math.min(
        containerWidth / imageWidth,
        containerHeight / imageHeight
      );
      width = imageWidth * containScale;
      height = imageHeight * containScale;
      x = (containerWidth - width) / 2;
      y = (containerHeight - height) / 2;
      break;

    case 'cover':
      const coverScale = Math.max(
        containerWidth / imageWidth,
        containerHeight / imageHeight
      );
      width = imageWidth * coverScale;
      height = imageHeight * coverScale;
      x = (containerWidth - width) / 2;
      y = (containerHeight - height) / 2;
      break;

    case 'fill':
      // Use the specified dimensions if available
      width = node.style.width ? resolveLength(node.style.width, containerWidth, { auto: "zero" }) : containerWidth;
      height = node.style.height ? resolveLength(node.style.height, containerHeight, { auto: "zero" }) : containerHeight;
      break;

    case 'none':
      // Use original image size
      width = imageWidth;
      height = imageHeight;
      x = (containerWidth - width) / 2;
      y = (containerHeight - height) / 2;
      break;

    case 'scale-down':
      const imageScale = Math.min(
        containerWidth / imageWidth,
        containerHeight / imageHeight
      );
      width = imageWidth * imageScale;
      height = imageHeight * imageScale;
      x = (containerWidth - width) / 2;
      y = (containerHeight - height) / 2;
      break;
  }

  return { x, y, width, height };
}

export class ImageLayoutStrategy implements LayoutStrategy {
  canLayout(node: LayoutNode): boolean {
    const tag = node.tagName?.toLowerCase() ?? "";
    if (tag === "img") {
      return true;
    }
    if (tag === "svg") {
      return Boolean(node.customData && "svg" in node.customData);
    }
    return false;
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    const widthRef = Math.max(cb.width, 0);
    const heightRef = Math.max(cb.height, 0);

    const intrinsicWidth = Math.max(0, node.intrinsicInlineSize ?? 0);
    const intrinsicHeight = Math.max(0, node.intrinsicBlockSize ?? 0);
    const hasIntrinsic = intrinsicWidth > 0 && intrinsicHeight > 0;

    const paddingLeft = resolveLength(node.style.paddingLeft, widthRef, { auto: "zero" });
    const paddingRight = resolveLength(node.style.paddingRight, widthRef, { auto: "zero" });
    const paddingTop = resolveLength(node.style.paddingTop, heightRef, { auto: "zero" });
    const paddingBottom = resolveLength(node.style.paddingBottom, heightRef, { auto: "zero" });

    const borderLeft = resolveLength(node.style.borderLeft, widthRef, { auto: "zero" });
    const borderRight = resolveLength(node.style.borderRight, widthRef, { auto: "zero" });
    const borderTop = resolveLength(node.style.borderTop, heightRef, { auto: "zero" });
    const borderBottom = resolveLength(node.style.borderBottom, heightRef, { auto: "zero" });

    const marginLeft = resolveLength(node.style.marginLeft, widthRef, { auto: "zero" });
    const marginRight = resolveLength(node.style.marginRight, widthRef, { auto: "zero" });
    const marginTop = resolveLength(node.style.marginTop, heightRef, { auto: "zero" });
    const marginBottom = resolveLength(node.style.marginBottom, heightRef, { auto: "zero" });

    const horizontalExtras = paddingLeft + paddingRight + borderLeft + borderRight;
    const verticalExtras = paddingTop + paddingBottom + borderTop + borderBottom;
    const availableContentWidth = Math.max(
      0,
      widthRef - horizontalNonContent(node, widthRef) - horizontalMargin(node, widthRef),
    );

    const hasExplicitWidth = node.style.width !== "auto" && node.style.width !== undefined;
    const hasExplicitHeight = node.style.height !== "auto" && node.style.height !== undefined;

    let contentWidth = hasIntrinsic ? intrinsicWidth : availableContentWidth;
    let contentHeight = hasIntrinsic ? intrinsicHeight : 0;

    if (hasExplicitWidth) {
      const resolved = resolveLength(node.style.width, widthRef, { auto: "reference" });
      if (Number.isFinite(resolved) && resolved > 0) {
        contentWidth = resolved;
      }
    }

    if (hasExplicitHeight) {
      const resolved = resolveLength(node.style.height, heightRef, { auto: "reference" });
      if (Number.isFinite(resolved) && resolved > 0) {
        contentHeight = resolved;
      }
    }

    if (hasIntrinsic) {
      if (hasExplicitWidth && !hasExplicitHeight) {
        const scale = intrinsicWidth > 0 ? contentWidth / intrinsicWidth : 1;
        contentHeight = Math.max(1, Math.round(intrinsicHeight * scale));
      } else if (!hasExplicitWidth && hasExplicitHeight) {
        const scale = intrinsicHeight > 0 ? contentHeight / intrinsicHeight : 1;
        contentWidth = Math.max(1, Math.round(intrinsicWidth * scale));
      } else if (!hasExplicitWidth && !hasExplicitHeight) {
        contentWidth = intrinsicWidth;
        contentHeight = intrinsicHeight;
      }
    }

    if (!hasExplicitWidth && availableContentWidth > 0 && contentWidth > availableContentWidth) {
      if (hasIntrinsic && contentWidth > 0) {
        const scale = availableContentWidth / contentWidth;
        contentWidth = availableContentWidth;
        contentHeight = Math.max(1, Math.round(contentHeight * scale));
      } else {
        contentWidth = availableContentWidth;
      }
    }

    // Apply max-width / min-width constraints while maintaining aspect ratio when possible.
    const lockAspectToWidth = hasIntrinsic && !hasExplicitHeight;
    const lockAspectToHeight = hasIntrinsic && !hasExplicitWidth;

    if (node.style.maxWidth !== undefined && !isAutoLength(node.style.maxWidth)) {
      const maxWidth = resolveLength(node.style.maxWidth, widthRef, { auto: "reference" });
      if (Number.isFinite(maxWidth) && maxWidth > 0 && contentWidth > maxWidth) {
        if (lockAspectToWidth && contentWidth > 0) {
          const scale = maxWidth / contentWidth;
          contentHeight = Math.max(1, Math.round(contentHeight * scale));
        }
        contentWidth = maxWidth;
      }
    }

    if (node.style.minWidth !== undefined && !isAutoLength(node.style.minWidth)) {
      const minWidth = resolveLength(node.style.minWidth, widthRef, { auto: "zero" });
      if (Number.isFinite(minWidth) && minWidth > 0 && contentWidth < minWidth) {
        if (lockAspectToWidth && contentWidth > 0) {
          const scale = minWidth / contentWidth;
          contentHeight = Math.max(1, Math.round(contentHeight * scale));
        }
        contentWidth = minWidth;
      }
    }

    if (node.style.maxHeight !== undefined && !isAutoLength(node.style.maxHeight)) {
      const maxHeight = resolveLength(node.style.maxHeight, heightRef, { auto: "reference" });
      if (Number.isFinite(maxHeight) && maxHeight > 0 && contentHeight > maxHeight) {
        if (lockAspectToHeight && contentHeight > 0) {
          const scale = maxHeight / contentHeight;
          contentWidth = Math.max(1, Math.round(contentWidth * scale));
        }
        contentHeight = maxHeight;
      }
    }

    if (node.style.minHeight !== undefined && !isAutoLength(node.style.minHeight)) {
      const minHeight = resolveLength(node.style.minHeight, heightRef, { auto: "zero" });
      if (Number.isFinite(minHeight) && minHeight > 0 && contentHeight < minHeight) {
        if (lockAspectToHeight && contentHeight > 0) {
          const scale = minHeight / contentHeight;
          contentWidth = Math.max(1, Math.round(contentWidth * scale));
        }
        contentHeight = minHeight;
      }
    }

    if (!Number.isFinite(contentWidth) || contentWidth <= 0) {
      contentWidth = Math.max(availableContentWidth, hasIntrinsic ? intrinsicWidth : 0);
    }
    if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
      if (hasIntrinsic && contentWidth > 0 && intrinsicWidth > 0) {
        const scale = contentWidth / intrinsicWidth;
        contentHeight = Math.max(1, Math.round(intrinsicHeight * scale));
      } else {
        contentHeight = contentWidth; // square fallback
      }
    }

    node.box.contentWidth = Math.max(0, contentWidth);
    node.box.contentHeight = Math.max(0, contentHeight);
    node.box.borderBoxWidth = node.box.contentWidth + horizontalExtras;
    node.box.borderBoxHeight = node.box.contentHeight + verticalExtras;
    node.box.marginBoxWidth = node.box.borderBoxWidth + marginLeft + marginRight;
    node.box.marginBoxHeight = node.box.borderBoxHeight + marginTop + marginBottom;
    node.box.scrollWidth = node.box.contentWidth;
    node.box.scrollHeight = node.box.contentHeight;
    node.box.baseline = node.box.borderBoxHeight;

    // For block-level images, ensure they do not exceed the available space.
    if (node.style.display === Display.Block && node.box.contentWidth > availableContentWidth && availableContentWidth > 0) {
      const scale = availableContentWidth / node.box.contentWidth;
      node.box.contentWidth = availableContentWidth;
      node.box.contentHeight = Math.max(1, Math.round(node.box.contentHeight * scale));
      node.box.borderBoxWidth = node.box.contentWidth + horizontalExtras;
      node.box.borderBoxHeight = node.box.contentHeight + verticalExtras;
      node.box.marginBoxWidth = node.box.borderBoxWidth + marginLeft + marginRight;
      node.box.marginBoxHeight = node.box.borderBoxHeight + marginTop + marginBottom;
      node.box.scrollWidth = node.box.contentWidth;
      node.box.scrollHeight = node.box.contentHeight;
      node.box.baseline = node.box.borderBoxHeight;
    }
  }
}
