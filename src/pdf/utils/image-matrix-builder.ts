import type { Rect } from "../types.js";
import { CoordinateTransformer } from "./coordinate-transformer.js";

export class ImageMatrixBuilder {
  constructor(private readonly coordinateTransformer: CoordinateTransformer) {}

  buildImageMatrix(rect: Rect): string | null {
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const widthPt = this.coordinateTransformer.convertPxToPt(rect.width);
    const heightPt = this.coordinateTransformer.convertPxToPt(rect.height);
    if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt === 0 || heightPt === 0) {
      return null;
    }
    const xPt = this.coordinateTransformer.convertPxToPt(rect.x);
    const localY = rect.y - this.coordinateTransformer.pageOffsetPx;
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY + rect.height);
    if (!Number.isFinite(xPt) || !Number.isFinite(yPt)) {
      return null;
    }
    return `${formatNumber(widthPt)} 0 0 ${formatNumber(heightPt)} ${formatNumber(xPt)} ${formatNumber(yPt)} cm`;
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
