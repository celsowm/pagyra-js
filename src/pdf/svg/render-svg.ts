import type { PagePainter } from "../page-painter.js";
import type { RenderBox } from "../types.js";
import type { SvgNode, SvgRootNode } from "../../svg/types.js";
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
import { computeStrokeScale, identityMatrix, type Matrix, multiplyMatrices, parseTransform } from "./matrix-utils.js";
import { getAlignFactors, parsePreserveAspectRatio } from "./aspect-ratio.js";

interface SvgCustomData {
  root: SvgRootNode;
  intrinsicWidth: number;
  intrinsicHeight: number;
}

export interface SvgRenderContext {
  painter: PagePainter;
  viewportMatrix: Matrix;
  transform: Matrix;
  strokeScale: number;
}

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
  };

  const baseStyle = createDefaultStyle();
  await renderNode(root, baseStyle, context);
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
