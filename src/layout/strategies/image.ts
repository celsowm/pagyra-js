import { LayoutNode } from "../../dom/node.js";
import { Display, FloatMode } from "../../css/enums.js";
import { resolveLength } from "../../css/length.js";
import type { ComputedStyle } from "../../css/style.js";
import type { ImageInfo } from "../../image/types.js";

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
    return element.tagName === 'img' || 
           element.tagName === 'picture' ||
           (element.textContent && element.textContent.includes('data:image'));
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
  
  if (style.backgroundSize) {
    if (style.backgroundSize === 'contain') return 'contain';
    if (style.backgroundSize === 'cover') return 'cover';
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
