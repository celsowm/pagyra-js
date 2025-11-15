import type { Rect, TextMatrix } from "../types.js";
import { CoordinateTransformer } from "./coordinate-transformer.js";
import { ShapeRenderer } from "../renderers/shape-renderer.js";
import { svgMatrixToPdf } from "../transform-adapter.js";

export class TransformScopeManager {
  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly shapeRenderer: ShapeRenderer,
  ) {}

  beginTransformScope(transform: TextMatrix, rect: Rect): void {
    // Store transform info for shape renderer to use
    const pdfMatrix = svgMatrixToPdf(transform);
    if (!pdfMatrix) {
      this.shapeRenderer.pushRawCommands(["q"]);
      return;
    }

    // Convert rect position to PDF coordinates
    const xPt = this.coordinateTransformer.convertPxToPt(rect.x);
    const localY = rect.y - this.coordinateTransformer.pageOffsetPx;
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY);

    // CSS transforms default to a 50% / 50% origin. Model that by translating
    // relative coordinates so the transform happens around the center of the
    // border box.
    const originOffsetX = Number.isFinite(rect.width) ? rect.width / 2 : 0;
    const originOffsetY = Number.isFinite(rect.height) ? rect.height / 2 : 0;
    const translateBackX = this.coordinateTransformer.convertPxToPt(-originOffsetX);
    const translateBackY = this.coordinateTransformer.convertPxToPt(originOffsetY);
    const translateForwardX = this.coordinateTransformer.convertPxToPt(originOffsetX);
    const translateForwardY = this.coordinateTransformer.convertPxToPt(-originOffsetY);

    // Set up transform context: translate to position, apply transform
    // This way shapes can be drawn at origin (0,0) and will be positioned and transformed correctly
    const cmds: string[] = [
      "q",
      // Position element on page (applied last in the matrix chain)
      `1 0 0 1 ${formatNumber(xPt)} ${formatNumber(yPt)} cm`,
      // Translate back from pivot after applying skew/rotate
      `1 0 0 1 ${formatNumber(translateForwardX)} ${formatNumber(translateForwardY)} cm`,
      // Apply the css transform (already converted into PDF space)
      `${formatNumber(pdfMatrix.a)} ${formatNumber(pdfMatrix.b)} ${formatNumber(pdfMatrix.c)} ${formatNumber(pdfMatrix.d)} 0 0 cm`,
      // Move the local coordinate system so the transform pivot is the center of the box
      `1 0 0 1 ${formatNumber(translateBackX)} ${formatNumber(translateBackY)} cm`,
    ];

    // Add marker for testing
    if (pdfMatrix.b !== 0 || pdfMatrix.c !== 0) {
      cmds.push(`%PAGYRA_TRANSFORM ${formatNumber(pdfMatrix.a)} ${formatNumber(pdfMatrix.b)} ${formatNumber(pdfMatrix.c)} ${formatNumber(pdfMatrix.d)} ${formatNumber(pdfMatrix.e)} ${formatNumber(pdfMatrix.f)}`);
    }

    this.shapeRenderer.pushRawCommands(cmds);
    this.shapeRenderer.setTransformContext(rect);
  }

  endTransformScope(): void {
    this.shapeRenderer.pushRawCommands(["Q"]);
    this.shapeRenderer.clearTransformContext();
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
