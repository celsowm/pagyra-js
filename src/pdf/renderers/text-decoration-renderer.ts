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

    const commands: string[] = [];
    const style = run.decorations.style ?? "solid";

    switch (style) {
      case "double":
        commands.push(...this.renderDouble(run, color));
        break;
      case "dotted":
      case "dashed":
        commands.push(...this.renderDashedOrDotted(run, color, style));
        break;
      case "wavy":
        commands.push(...this.renderWavy(run, color));
        break;
      case "solid":
      default:
        commands.push(...this.renderSolid(run, color));
        break;
    }

    return commands;
  }

  private renderSolid(run: Run, color: RGBA): string[] {
    const matrix = run.lineMatrix;
    if (!matrix) {
      return [];
    }
    const widthPx = Math.max(run.advanceWidth ?? 0, 0);
    if (widthPx <= 0) {
      return [];
    }

    const rects: Rect[] = [];
    if (run.decorations?.lineThrough) {
      const thicknessPx = Math.max(run.fontSize * 0.085, 0.5);
      const centerYPx = matrix.f - run.fontSize * 0.3;
      rects.push({
        x: matrix.e,
        y: centerYPx - thicknessPx / 2,
        width: widthPx,
        height: thicknessPx,
      });
    }
    if (run.decorations?.underline) {
      const thicknessPx = Math.max(run.fontSize * 0.065, 0.5);
      const underlineYPx = matrix.f + run.fontSize * 0.1;
      rects.push({
        x: matrix.e,
        y: underlineYPx - thicknessPx / 2,
        width: widthPx,
        height: thicknessPx,
      });
    }
    if (run.decorations?.overline) {
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
    const decorationColor = run.decorations?.color ?? color;
    for (const rect of rects) {
      const pdfRect = this.rectToPdf(rect);
      if (!pdfRect) {
        continue;
      }
      commands.push(
        fillColorCommand(decorationColor, this.graphicsStateManager),
        `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`,
        "f",
      );
    }
    return commands;
  }

  private renderDouble(run: Run, color: RGBA): string[] {
    const matrix = run.lineMatrix;
    if (!matrix || (!run.decorations?.underline && !run.decorations?.overline && !run.decorations?.lineThrough)) {
      return [];
    }
    const widthPx = Math.max(run.advanceWidth ?? 0, 0);
    if (widthPx <= 0) {
      return [];
    }

    const commands: string[] = [];
    const decorationColor = run.decorations?.color ?? color;

    const pushLinePair = (centerY: number, thickness: number) => {
      const gap = Math.max(thickness * 0.8, 0.5);
      const singleHeight = Math.max(thickness * 0.8, 0.5);
      const firstY = centerY - gap / 2 - singleHeight / 2;
      const secondY = centerY + gap / 2 - singleHeight / 2;
      const rects: Rect[] = [
        { x: matrix.e, y: firstY, width: widthPx, height: singleHeight },
        { x: matrix.e, y: secondY, width: widthPx, height: singleHeight },
      ];
      for (const rect of rects) {
        const pdfRect = this.rectToPdf(rect);
        if (!pdfRect) continue;
        commands.push(
          fillColorCommand(decorationColor, this.graphicsStateManager),
          `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`,
          "f",
        );
      }
    };

    if (run.decorations.lineThrough) {
      const thicknessPx = Math.max(run.fontSize * 0.085, 0.5);
      const centerYPx = matrix.f - run.fontSize * 0.3;
      pushLinePair(centerYPx, thicknessPx);
    }
    if (run.decorations.underline) {
      const thicknessPx = Math.max(run.fontSize * 0.065, 0.5);
      const underlineYPx = matrix.f + run.fontSize * 0.1;
      pushLinePair(underlineYPx, thicknessPx);
    }
    if (run.decorations.overline) {
      const thicknessPx = Math.max(run.fontSize * 0.05, 0.5);
      const overlineYPx = matrix.f - run.fontSize * 0.9;
      pushLinePair(overlineYPx, thicknessPx);
    }

    return commands;
  }

  private renderDashedOrDotted(run: Run, color: RGBA, style: "dashed" | "dotted"): string[] {
    const matrix = run.lineMatrix;
    if (!matrix || (!run.decorations?.underline && !run.decorations?.overline && !run.decorations?.lineThrough)) {
      return [];
    }
    const widthPx = Math.max(run.advanceWidth ?? 0, 0);
    if (widthPx <= 0) {
      return [];
    }

    const decorationColor = run.decorations?.color ?? color;
    const commands: string[] = [];

    const thicknessBase = run.fontSize * 0.065;
    const lineWidthPx = Math.max(thicknessBase, 0.5);
    const dashUnit = Math.max(lineWidthPx, 0.5);
    const dashPattern =
      style === "dashed"
        ? [3 * dashUnit, 3 * dashUnit]
        : [dashUnit, dashUnit];

    const pushLine = (yPx: number) => {
      const xStartPt = formatNumber(this.coordinateTransformer.convertPxToPt(matrix.e));
      const xEndPt = formatNumber(this.coordinateTransformer.convertPxToPt(matrix.e + widthPx));
      const localY = yPx - this.coordinateTransformer.pageOffsetPx;
      const yPt = formatNumber(
        this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY),
      );
      const widthPt = this.coordinateTransformer.convertPxToPt(Math.max(lineWidthPx, 0));
      const dashPt = dashPattern
        .map((v) => this.coordinateTransformer.convertPxToPt(Math.max(v, 0)))
        .map(formatNumber)
        .join(" ");

      commands.push(
        fillColorCommand(decorationColor, this.graphicsStateManager),
        `${widthPt > 0 ? formatNumber(widthPt) : "0"} w`,
        `[${dashPt}] 0 d`,
        `${xStartPt} ${yPt} m`,
        `${xEndPt} ${yPt} l`,
        "S",
        "[] 0 d",
      );
    };

    if (run.decorations.lineThrough) {
      const centerYPx = matrix.f - run.fontSize * 0.3;
      pushLine(centerYPx);
    }
    if (run.decorations.underline) {
      const underlineYPx = matrix.f + run.fontSize * 0.1;
      pushLine(underlineYPx);
    }
    if (run.decorations.overline) {
      const overlineYPx = matrix.f - run.fontSize * 0.9;
      pushLine(overlineYPx);
    }

    return commands;
  }

  private renderWavy(run: Run, color: RGBA): string[] {
    const matrix = run.lineMatrix;
    if (!matrix || (!run.decorations?.underline && !run.decorations?.overline && !run.decorations?.lineThrough)) {
      return [];
    }
    const widthPx = Math.max(run.advanceWidth ?? 0, 0);
    if (widthPx <= 0) {
      return [];
    }

    const decorationColor = run.decorations?.color ?? color;
    const commands: string[] = [];

    const amplitudePx = Math.max(run.fontSize * 0.08, 0.5);
    const wavelengthPx = Math.max(run.fontSize * 0.4, 2);
    const lineWidthPx = Math.max(run.fontSize * 0.065, 0.5);

    const buildWavePoints = (baselineY: number): { x: number; y: number }[] => {
      const points: { x: number; y: number }[] = [];
      const steps = Math.max(Math.round(widthPx / (wavelengthPx / 2)), 2);
      for (let i = 0; i <= steps; i++) {
        const x = matrix.e + (widthPx * i) / steps;
        const phase = i % 2 === 0 ? -1 : 1;
        const y = baselineY + phase * amplitudePx;
        points.push({ x, y });
      }
      return points;
    };

    const pushWave = (baselineY: number) => {
      const points = buildWavePoints(baselineY);
      if (points.length < 2) {
        return;
      }

      const localY = points[0].y - this.coordinateTransformer.pageOffsetPx;
      const yPtFirst = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY);
      const xPtFirst = this.coordinateTransformer.convertPxToPt(points[0].x);
      const widthPt = this.coordinateTransformer.convertPxToPt(Math.max(lineWidthPx, 0));

      commands.push(
        fillColorCommand(decorationColor, this.graphicsStateManager),
        `${formatNumber(widthPt)} w`,
      );

      commands.push(
        `${formatNumber(xPtFirst)} ${formatNumber(yPtFirst)} m`,
      );

      for (let i = 1; i < points.length; i++) {
        const localYPoint = points[i].y - this.coordinateTransformer.pageOffsetPx;
        const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localYPoint);
        const xPt = this.coordinateTransformer.convertPxToPt(points[i].x);
        commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} l`);
      }

      commands.push("S");
    };

    if (run.decorations.lineThrough) {
      const centerYPx = matrix.f - run.fontSize * 0.3;
      pushWave(centerYPx);
    }
    if (run.decorations.underline) {
      const underlineYPx = matrix.f + run.fontSize * 0.1;
      pushWave(underlineYPx);
    }
    if (run.decorations.overline) {
      const overlineYPx = matrix.f - run.fontSize * 0.9;
      pushWave(overlineYPx);
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
