import type { PagePainter } from "../page-painter.js";
import type { RenderBox } from "../types.js";
import type { SvgNode, SvgRootNode, SvgImageNode } from "../../svg/types.js";
import path from "path";
import {
  renderCircle,
  renderEllipse,
  renderLine,
  renderPath,
  renderPolygon,
  renderPolyline,
  renderRect,
  renderText,
} from "./shape-renderer.js";
import { createDefaultStyle, deriveStyle, type SvgStyle } from "./style-computer.js";
import { computeStrokeScale, identityMatrix, multiplyMatrices, type Matrix } from "../../geometry/matrix.js";
import { parseTransform } from "../../transform/css-parser.js";
import { mapSvgPoint } from "./coordinate-mapper.js";
import { ImageService } from "../../image/image-service.js";
import { getAlignFactors, parsePreserveAspectRatio } from "./aspect-ratio.js";

interface SvgCustomData {
  root: SvgRootNode;
  intrinsicWidth: number;
  intrinsicHeight: number;
  resourceBaseDir?: string;
  assetRootDir?: string;
}

export interface SvgRenderContext {
  painter: PagePainter;
  viewportMatrix: Matrix;
  transform: Matrix;
  strokeScale: number;
  // optional resource roots propagated from HTML conversion
  resourceBaseDir?: string;
  assetRootDir?: string;
}

// Map of defs by id (gradients, clipPaths, etc.) built once per svg render
export type SvgDefsMap = Map<string, any>;

export async function renderSvgBox(painter: PagePainter, box: RenderBox): Promise<void> {
  const svgData = extractSvgCustomData(box);
  if (!svgData) {
    return;
  }

  const { root } = svgData;
  const content = box.contentBox;
  const widthPx = Math.max(content.width, 0);
  const heightPx = Math.max(content.height, 0);
  if (widthPx <= 0 || heightPx <= 0) {
    return;
  }

  const sourceWidth = resolvePositive(root.viewBox?.width ?? svgData.intrinsicWidth ?? widthPx);
  const sourceHeight = resolvePositive(root.viewBox?.height ?? svgData.intrinsicHeight ?? heightPx);
  const minX = root.viewBox?.minX ?? 0;
  const minY = root.viewBox?.minY ?? 0;

  const preserveAttr = root.attributes?.preserveAspectRatio ?? root.attributes?.preserveaspectratio;
  const preserve = parsePreserveAspectRatio(typeof preserveAttr === "string" ? preserveAttr : undefined);

  const baseScaleX = safeScale(widthPx / sourceWidth);
  const baseScaleY = safeScale(heightPx / sourceHeight);

  let scaleX = baseScaleX;
  let scaleY = baseScaleY;
  let offsetX = 0;
  let offsetY = 0;

  if (preserve.align !== "none") {
    const uniformScale = preserve.meetOrSlice === "slice" ? Math.max(baseScaleX, baseScaleY) : Math.min(baseScaleX, baseScaleY);
    scaleX = uniformScale;
    scaleY = uniformScale;
    const scaledWidth = sourceWidth * scaleX;
    const scaledHeight = sourceHeight * scaleY;
    const extraWidth = widthPx - scaledWidth;
    const extraHeight = heightPx - scaledHeight;
    const factors = getAlignFactors(preserve.align);
    offsetX = extraWidth * factors.x;
    offsetY = extraHeight * factors.y;
  }

  const viewportMatrix: Matrix = {
    a: scaleX,
    b: 0,
    c: 0,
    d: scaleY,
    e: content.x + offsetX - minX * scaleX,
    f: content.y + offsetY - minY * scaleY,
  };

  const initialTransform = identityMatrix();
  const strokeScale = computeStrokeScale(viewportMatrix, initialTransform);

  const context: SvgRenderContext = {
    painter,
    viewportMatrix,
    transform: initialTransform,
    strokeScale,
    // resource roots will be set below from the box customData if available
  };

  // Build defs map (id -> node) so paint servers like gradients can be resolved during rendering
  const defs = new Map<string, any>();
  collectDefs(root, defs);
  // Attach to context for downstream use
  (context as any).defs = defs;

  // If convertDomNode attached resource roots into the customData for this SVG, copy them to context
  if ((svgData as any).resourceBaseDir) {
    context.resourceBaseDir = (svgData as any).resourceBaseDir as string;
  }
  if ((svgData as any).assetRootDir) {
    context.assetRootDir = (svgData as any).assetRootDir as string;
  }

  const baseStyle = createDefaultStyle();
  await renderNode(root, baseStyle, context);
}

function collectDefs(node: SvgNode, map: Map<string, any>): void {
  if (!node) return;
  // If node has an id, register it
  const id = (node as any).id;
  if (id && typeof id === "string") {
    map.set(id, node);
  }
  // Recurse into children for container nodes
  if ((node as any).children && Array.isArray((node as any).children)) {
    for (const child of (node as any).children) {
      collectDefs(child, map);
    }
  }
}

function extractSvgCustomData(box: RenderBox): SvgCustomData | null {
  const raw = box.customData?.svg;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const candidate = raw as Partial<SvgCustomData>;
  if (!candidate.root) {
    return null;
  }
  return {
    root: candidate.root,
    intrinsicWidth: resolvePositive(candidate.intrinsicWidth ?? 0),
    intrinsicHeight: resolvePositive(candidate.intrinsicHeight ?? 0),
    resourceBaseDir: candidate.resourceBaseDir,
    assetRootDir: candidate.assetRootDir,
  };
}

async function renderNode(node: SvgNode, style: SvgStyle, context: SvgRenderContext): Promise<void> {
  let workingContext = context;
  const nodeTransform = parseTransform(node.transform);
  if (nodeTransform) {
    const combined = multiplyMatrices(context.transform, nodeTransform);
    workingContext = {
      painter: context.painter,
      viewportMatrix: context.viewportMatrix,
      transform: combined,
      strokeScale: computeStrokeScale(context.viewportMatrix, combined),
    };
  }

  switch (node.type) {
    case "svg":
    case "g": {
      const nextStyle = deriveStyle(style, node);
      for (const child of node.children) {
        await renderNode(child, nextStyle, workingContext);
      }
      return;
    }
    case "rect":
      return renderRect(node, deriveStyle(style, node), workingContext);
    case "circle":
      return renderCircle(node, deriveStyle(style, node), workingContext);
    case "ellipse":
      return renderEllipse(node, deriveStyle(style, node), workingContext);
    case "polygon":
      return renderPolygon(node, deriveStyle(style, node), workingContext);
    case "polyline":
      return renderPolyline(node, deriveStyle(style, node), workingContext);
    case "line":
      return renderLine(node, deriveStyle(style, node), workingContext);
    case "text":
      return renderText(node, deriveStyle(style, node), workingContext);
    case "image":
      // Render SVG <image> elements by loading the referenced image and drawing it
      return await renderImage(node as SvgImageNode, deriveStyle(style, node), workingContext);
    case "path":
      return renderPath(node, deriveStyle(style, node), workingContext);
    default:
      return;
  }
}

function safeScale(value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    return 1;
  }
  return value;
}

function resolvePositive(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return value;
}

async function renderImage(node: SvgImageNode, style: SvgStyle, context: SvgRenderContext): Promise<void> {
  const hrefAttr = node.href ?? node.attributes?.href ?? node.attributes?.["xlink:href"];
  if (!hrefAttr || typeof hrefAttr !== "string") {
    return;
  }

  let imageInfo;
  const imageService = ImageService.getInstance();
  try {
    if (hrefAttr.startsWith("data:")) {
      // data URI
      const comma = hrefAttr.indexOf(",");
      if (comma < 0) return;
      const meta = hrefAttr.substring(5, comma);
      const isBase64 = meta.endsWith(";base64");
      const payload = hrefAttr.substring(comma + 1);
      const buffer = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      imageInfo = await imageService.decodeImage(arrayBuffer);
    } else if (/^https?:\/\//i.test(hrefAttr)) {
      // Remote images not supported in this offline renderer
      console.debug("Skipping remote image in SVG:", hrefAttr);
      return;
    } else {
      // Local file reference. Resolve using assetRootDir for absolute (/images/...) or resourceBaseDir for relative
      let resolved: string;
      if (hrefAttr.startsWith("/")) {
        const root = context.assetRootDir ?? process.cwd();
        resolved = path.join(root, hrefAttr.replace(/^\//, ""));
      } else {
        const base = context.resourceBaseDir ?? process.cwd();
        resolved = path.resolve(base, hrefAttr);
      }
      imageInfo = await imageService.loadImage(resolved);
      // Attach resolved path back to href for later reporting
      (node as any)._resolvedHref = resolved;
    }
  } catch (err) {
    console.debug("Failed to load SVG image", hrefAttr, err instanceof Error ? err.message : err);
    return;
  }

  if (!imageInfo) return;

  const drawWidth = Number.isFinite(node.width as number) ? (node.width as number) : imageInfo.width;
  const drawHeight = Number.isFinite(node.height as number) ? (node.height as number) : imageInfo.height;

  const p1 = mapSvgPoint(Number(node.x ?? 0), Number(node.y ?? 0), context);
  const p2 = mapSvgPoint(Number(node.x ?? 0) + drawWidth, Number(node.y ?? 0) + drawHeight, context);
  if (!p1 || !p2) {
    return;
  }

  const rect = { x: p1.x, y: p1.y, width: p2.x - p1.x, height: p2.y - p1.y };

  const imageRef = {
    src: (node as any)._resolvedHref ?? hrefAttr,
    width: imageInfo.width,
    height: imageInfo.height,
    format: imageInfo.format,
    channels: imageInfo.channels,
    bitsPerComponent: imageInfo.bitsPerChannel,
    data: imageInfo.data,
  } as const;

  try {
    context.painter.drawImage(imageRef as any, rect);
  } catch (err) {
    console.debug("Failed to draw image in SVG", hrefAttr, err instanceof Error ? err.message : err);
  }
}
