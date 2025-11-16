import type { RGBA, Rect, Run } from "../types.js";
import type { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";
import { fillColorCommand, formatNumber } from "./text-renderer-utils.js";

export class TextDecorationRenderer {
  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly graphicsStateManager?: GraphicsStateManager,
  ) {}

  render(run: Run, color: RGBA): string[] {
    if (!run.decorations) {
      return [];
    }
    const matrix = run.lineMatrix;
    if (!matrix) {
      return [];
    }

    const widthPx = Math.max(run.advanceWidth ?? 0, 0);
    if (widthPx <= 0) {
      return [];
    }

    const rects: Rect[] = [];
    if (run.decorations.lineThrough) {
      const thicknessPx = Math.max(run.fontSize * 0.085, 0.5);
      const centerYPx = matrix.f - run.fontSize * 0.3;
      rects.push({
        x: matrix.e,
        y: centerYPx - thicknessPx / 2,
        width: widthPx,
        height: thicknessPx,
      });
    }
    if (run.decorations.underline) {
      const thicknessPx = Math.max(run.fontSize * 0.065, 0.5);
      const underlineYPx = matrix.f + run.fontSize * 0.1;
      rects.push({
        x: matrix.e,
        y: underlineYPx - thicknessPx / 2,
        width: widthPx,
        height: thicknessPx,
      });
    }
    if (run.decorations.overline) {
      const thicknessPx = Math.max(run.fontSize * 0.05, 0.5);
      const overlineYPx = matrix.f - run.fontSize * 0.9;
      rects.push({
        x: matrix.e,
        y: overlineYPx - thicknessPx / 2,
        width: widthPx,
        height: thicknessPx,
      });
    }

    const commands: string[] = [];
    for (const rect of rects) {
      const pdfRect = this.rectToPdf(rect);
      if (!pdfRect) {
        continue;
      }
      commands.push(
        fillColorCommand(color, this.graphicsStateManager),
        `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`,
        "f",
      );
    }
    return commands;
  }

  private rectToPdf(rect: Rect | null | undefined):
    | { x: string; y: string; width: string; height: string }
    | null {
    if (!rect) {
      return null;
    }
    const widthPx = Math.max(rect.width, 0);
    const heightPx = Math.max(rect.height, 0);
    if (widthPx === 0 || heightPx === 0) {
      return null;
    }
    const localY = rect.y - this.coordinateTransformer.pageOffsetPx;
    const x = this.coordinateTransformer.convertPxToPt(rect.x);
    const y = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY + heightPx);
    const width = this.coordinateTransformer.convertPxToPt(widthPx);
    const height = this.coordinateTransformer.convertPxToPt(heightPx);
    return {
      x: formatNumber(x),
      y: formatNumber(y),
      width: formatNumber(width),
      height: formatNumber(height),
    };
  }
}
