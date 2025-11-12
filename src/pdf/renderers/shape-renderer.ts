import type { RGBA, Rect, Radius } from "../types.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import { GradientService } from "../shading/gradient-service.js";
import { parseLinearGradient, type LinearGradient, type RadialGradient } from "../../css/parsers/gradient-parser.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";

export interface ShapePoint {
  x: number;
  y: number;
}

export type PathCommand =
  | { type: "moveTo"; x: number; y: number }
  | { type: "lineTo"; x: number; y: number }
  | { type: "curveTo"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "closePath" };

export interface ShapeRendererResult {
  readonly commands: string[];
  readonly shadings: Map<string, string>;
}

export class ShapeRenderer {
  private readonly commands: string[] = [];
  private readonly gradientService: GradientService;
  private transformContext: Rect | null = null;

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
    private readonly graphicsStateManager: GraphicsStateManager,
  ) {
    this.gradientService = new GradientService(coordinateTransformer);
  }

  setTransformContext(rect: Rect): void {
    this.transformContext = rect;
  }

  clearTransformContext(): void {
    this.transformContext = null;
  }

  drawBoxOutline(rect: Rect, color: RGBA = { r: 0.85, g: 0.85, b: 0.85, a: 1 }): void {
    this.strokeRect(rect, color);
  }

  drawFilledBox(rect: Rect, color: RGBA): void {
    this.fillRect(rect, color);
  }

  fillRoundedRect(rect: Rect, radii: Radius, paint: RGBA | LinearGradient | RadialGradient | string): void {
    // Note: RadialGradient support will be accepted via painter API too
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return;
    }

    const gradient = resolveGradientPaint(paint) as LinearGradient | RadialGradient | null;
    if (gradient) {
      if ((gradient as RadialGradient).type === "radial") {
        this.fillRoundedRectWithRadialGradient(rect, radii, gradient as RadialGradient);
      } else {
        this.fillRoundedRectWithGradient(rect, radii, gradient as LinearGradient);
      }
      return;
    }

    if (typeof paint !== "object" || paint === null) {
      return;
    }

    const adjusted = this.normalizeRadiiForRect(width, height, radii);
    if (this.isZeroRadius(adjusted)) {
      this.fillRect(rect, paint as RGBA);
      return;
    }
    const path = this.roundedRectPath(width, height, adjusted, 0, 0);
    if (path.length === 0) {
      return;
    }
    const commands = [this.transformForRect(rect), ...path, "f"];
    this.pushFillCommands(paint as RGBA, commands, true);
  }

  // Allow low-level injection of drawing commands to preserve ordering (used for raster shadows)
  pushRawCommands(commands: string[]): void {
    if (!Array.isArray(commands) || commands.length === 0) return;
    this.commands.push(...commands);
  }

  private fillRoundedRectWithGradient(rect: Rect, radii: Radius, gradient: LinearGradient): void {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return;
    }

    const adjusted = this.normalizeRadiiForRect(width, height, radii);
    if (this.isZeroRadius(adjusted)) {
      this.fillRectWithGradient(rect, gradient);
      return;
    }

    const path = this.roundedRectPath(width, height, adjusted, 0, 0);
    if (path.length === 0) {
      return;
    }

    const shading = this.gradientService.createLinearGradient(gradient, rect);
    this.commands.push("q");
    this.commands.push(this.transformForRect(rect));
    this.commands.push(...path);
    this.commands.push("W n");
    this.commands.push(`/${shading.shadingName} sh`);
    this.commands.push("Q");
  }

  private fillRectWithGradient(rect: Rect, gradient: LinearGradient): void {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return;
    }

    const shading = this.gradientService.createLinearGradient(gradient, rect);
    this.commands.push("q");
    this.commands.push(this.transformForRect(rect));
    this.commands.push(`0 0 ${formatNumber(width)} ${formatNumber(height)} re`);
    this.commands.push("W n");
    this.commands.push(`/${shading.shadingName} sh`);
    this.commands.push("Q");
  }

  private fillRoundedRectWithRadialGradient(rect: Rect, radii: Radius, gradient: RadialGradient): void {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return;
    }

    const adjusted = this.normalizeRadiiForRect(width, height, radii);
    if (this.isZeroRadius(adjusted)) {
      this.fillRectWithRadialGradient(rect, gradient);
      return;
    }

    const path = this.roundedRectPath(width, height, adjusted, 0, 0);
    if (path.length === 0) {
      return;
    }

    const shading = this.gradientService.createRadialGradient(gradient, rect);
    this.commands.push("q");
    this.commands.push(this.transformForRect(rect));
    this.commands.push(...path);
    this.commands.push("W n");
    this.commands.push(`/${shading.shadingName} sh`);
    this.commands.push("Q");
  }

  private fillRectWithRadialGradient(rect: Rect, gradient: RadialGradient): void {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return;
    }

    const shading = this.gradientService.createRadialGradient(gradient, rect);
    this.commands.push("q");
    this.commands.push(this.transformForRect(rect));
    this.commands.push(`0 0 ${formatNumber(width)} ${formatNumber(height)} re`);
    this.commands.push("W n");
    this.commands.push(`/${shading.shadingName} sh`);
    this.commands.push("Q");
  }

  fillRoundedRectDifference(outerRect: Rect, outerRadii: Radius, innerRect: Rect, innerRadii: Radius, color: RGBA): void {
    const outerWidth = Math.max(outerRect.width, 0);
    const outerHeight = Math.max(outerRect.height, 0);
    if (outerWidth === 0 || outerHeight === 0) {
      return;
    }
    const outerAdjusted = this.normalizeRadiiForRect(outerWidth, outerHeight, outerRadii);
    const innerWidth = Math.max(innerRect.width, 0);
    const innerHeight = Math.max(innerRect.height, 0);

    if (innerWidth <= 0 || innerHeight <= 0) {
      // Border fully covers the box; fall back to filling the outer shape.
      this.fillRoundedRect(outerRect, outerAdjusted, color);
      return;
    }

    const pathOuter = this.roundedRectPath(outerWidth, outerHeight, outerAdjusted, 0, 0);
    if (pathOuter.length === 0) {
      return;
    }

    const innerAdjusted = this.normalizeRadiiForRect(innerWidth, innerHeight, innerRadii);
    const offsetX = innerRect.x - outerRect.x;
    const offsetY = innerRect.y - outerRect.y;
    const pathInner = this.roundedRectPath(innerWidth, innerHeight, innerAdjusted, offsetX, offsetY);

    const commands = [this.transformForRect(outerRect), ...pathOuter, ...pathInner, "f*"];
    this.pushFillCommands(color, commands, true);
  }

  fillRect(rect: Rect, paint: RGBA | LinearGradient | RadialGradient | string): void {
    const gradient = resolveGradientPaint(paint);
    if (gradient) {
      if ((gradient as RadialGradient).type === "radial") {
        this.fillRectWithRadialGradient(rect, gradient as RadialGradient);
      } else {
        this.fillRectWithGradient(rect, gradient as LinearGradient);
      }
      return;
    }

    if (typeof paint !== "object" || paint === null) {
      return;
    }

    const pdfRect = this.rectToPdf(rect);
    if (!pdfRect) {
      return;
    }
    const commands = [`${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "f"];
    this.pushFillCommands(paint as RGBA, commands, false);
  }

  strokeRect(rect: Rect, color: RGBA): void {
    const pdfRect = this.rectToPdf(rect);
    if (!pdfRect) {
      return;
    }
    this.commands.push(strokeColorCommand(color), `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "S");
  }

  strokeRoundedRect(rect: Rect, radii: Radius, color: RGBA, lineWidth?: number): void {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return;
    }
    const adjusted = this.normalizeRadiiForRect(width, height, radii);
    const path = this.roundedRectPath(width, height, adjusted, 0, 0);
    if (path.length === 0) {
      return;
    }
    this.commands.push("q", strokeColorCommand(color));
    if (lineWidth !== undefined) {
      const strokeWidthPt = this.coordinateTransformer.convertPxToPt(Math.max(lineWidth, 0));
      if (strokeWidthPt > 0) {
        this.commands.push(`${formatNumber(strokeWidthPt)} w`);
      }
    }
    this.commands.push(this.transformForRect(rect), ...path, "S", "Q");
  }

  fillPolygon(points: ShapePoint[], color: RGBA, close: boolean = true): void {
    if (points.length < 2) {
      return;
    }
    const pdfPoints = this.pointsToPdf(points);
    if (!pdfPoints) {
      return;
    }
    const commands: string[] = [];
    commands.push(`${pdfPoints[0].x} ${pdfPoints[0].y} m`);
    for (let index = 1; index < pdfPoints.length; index++) {
      const point = pdfPoints[index];
      commands.push(`${point.x} ${point.y} l`);
    }
    if (close) {
      commands.push("h");
    }
    commands.push("f");
    this.pushFillCommands(color, commands, true);
  }

  strokePolyline(
    points: ShapePoint[],
    color: RGBA,
    options: { lineWidth?: number; lineCap?: "butt" | "round" | "square"; lineJoin?: "miter" | "round" | "bevel"; close?: boolean } = {},
  ): void {
    if (points.length < 2) {
      return;
    }
    const pdfPoints = this.pointsToPdf(points);
    if (!pdfPoints) {
      return;
    }
    const commands: string[] = [];
    commands.push(`${pdfPoints[0].x} ${pdfPoints[0].y} m`);
    for (let index = 1; index < pdfPoints.length; index++) {
      const point = pdfPoints[index];
      commands.push(`${point.x} ${point.y} l`);
    }
    if (options.close) {
      commands.push("h");
    }
    commands.push("S");
    this.commands.push("q", strokeColorCommand(color));
    if (options.lineWidth !== undefined) {
      const widthPt = this.coordinateTransformer.convertPxToPt(Math.max(options.lineWidth, 0));
      if (widthPt > 0) {
        this.commands.push(`${formatNumber(widthPt)} w`);
      }
    }
    const cap = mapLineCap(options.lineCap);
    if (cap !== undefined) {
      this.commands.push(`${cap} J`);
    }
    const join = mapLineJoin(options.lineJoin);
    if (join !== undefined) {
      this.commands.push(`${join} j`);
    }
    this.commands.push(...commands, "Q");
  }

  fillPath(commands: PathCommand[], color: RGBA, options: { fillRule?: "nonzero" | "evenodd" } = {}): void {
    if (commands.length === 0) {
      return;
    }
    const pdfCommands = this.pathCommandsToPdf(commands);
    if (!pdfCommands || pdfCommands.length === 0) {
      return;
    }
    const operator = options.fillRule === "evenodd" ? "f*" : "f";
    this.pushFillCommands(color, [...pdfCommands, operator], false);
  }

  // New: fill an arbitrary path with a gradient. We compute a bounding box of the path
  // (in page pixels) and use it as the gradient rectangle when creating the shading.
  // The path itself is converted to PDF commands and used as the clipping path before
  // painting the shading.
  fillPathWithGradient(commands: PathCommand[], gradient: LinearGradient | RadialGradient, options: { fillRule?: "nonzero" | "evenodd" } = {}): void {
    if (!commands || commands.length === 0) return;
    const pdfCommands = this.pathCommandsToPdf(commands);
    if (!pdfCommands || pdfCommands.length === 0) return;

    // Compute bounding box in page pixels from PathCommand (these are given in page px)
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const cmd of commands) {
      if (cmd.type === "moveTo" || cmd.type === "lineTo") {
        minX = Math.min(minX, cmd.x);
        minY = Math.min(minY, cmd.y);
        maxX = Math.max(maxX, cmd.x);
        maxY = Math.max(maxY, cmd.y);
      } else if (cmd.type === "curveTo") {
        minX = Math.min(minX, cmd.x1, cmd.x2, cmd.x);
        minY = Math.min(minY, cmd.y1, cmd.y2, cmd.y);
        maxX = Math.max(maxX, cmd.x1, cmd.x2, cmd.x);
        maxY = Math.max(maxY, cmd.y1, cmd.y2, cmd.y);
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return;
    }
    const rect = { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };

    // Create shading
    const shading = (gradient as RadialGradient).type === "radial"
      ? this.gradientService.createRadialGradient(gradient as RadialGradient, rect)
      : this.gradientService.createLinearGradient(gradient as LinearGradient, rect);

    // Emit clipping path then shading
    this.commands.push("q");
    this.commands.push(...pdfCommands);
    // Use W n to set clipping path (nonzero/even-odd determined by the fill operator we use)
    this.commands.push("W n");
    this.commands.push(`/${shading.shadingName} sh`);
    this.commands.push("Q");
  }

  strokePath(
    commands: PathCommand[],
    color: RGBA,
    options: { lineWidth?: number; lineCap?: "butt" | "round" | "square"; lineJoin?: "miter" | "round" | "bevel" } = {},
  ): void {
    if (commands.length === 0) {
      return;
    }
    const pdfCommands = this.pathCommandsToPdf(commands);
    if (!pdfCommands || pdfCommands.length === 0) {
      return;
    }
    this.commands.push("q", strokeColorCommand(color));
    if (options.lineWidth !== undefined) {
      const widthPt = this.coordinateTransformer.convertPxToPt(Math.max(options.lineWidth, 0));
      if (widthPt > 0) {
        this.commands.push(`${formatNumber(widthPt)} w`);
      }
    }
    const cap = mapLineCap(options.lineCap);
    if (cap !== undefined) {
      this.commands.push(`${cap} J`);
    }
    const join = mapLineJoin(options.lineJoin);
    if (join !== undefined) {
      this.commands.push(`${join} j`);
    }
    this.commands.push(...pdfCommands, "S", "Q");
  }

  private pushFillCommands(color: RGBA, commands: string[], wrapWithQ: boolean): void {
    const alpha = color.a ?? 1;
    const hasAlpha = alpha < 1;
    const baseColor: RGBA = { r: color.r, g: color.g, b: color.b, a: alpha };
    const needsIsolation = wrapWithQ || hasAlpha;
    this.commands.push(fillColorCommand(baseColor));
    if (needsIsolation) {
      this.commands.push("q");
    }
    if (hasAlpha) {
      const state = this.graphicsStateManager.ensureFillAlphaState(alpha);
      this.commands.push(`/${state} gs`);
    }
    this.commands.push(...commands);
    if (needsIsolation) {
      this.commands.push("Q");
    }
  }

  private normalizeRadiiForRect(width: number, height: number, radii: Radius): Radius {
    const result: Radius = {
      topLeft: { ...radii.topLeft },
      topRight: { ...radii.topRight },
      bottomRight: { ...radii.bottomRight },
      bottomLeft: { ...radii.bottomLeft },
    };

    const safeWidth = Math.max(width, 0);
    const safeHeight = Math.max(height, 0);

    if (safeWidth <= 0) {
      result.topLeft.x = 0;
      result.topRight.x = 0;
      result.bottomRight.x = 0;
      result.bottomLeft.x = 0;
    } else {
      const topSum = result.topLeft.x + result.topRight.x;
      if (topSum > safeWidth && topSum > 0) {
        const scale = safeWidth / topSum;
        result.topLeft.x *= scale;
        result.topRight.x *= scale;
      }
      const bottomSum = result.bottomLeft.x + result.bottomRight.x;
      if (bottomSum > safeWidth && bottomSum > 0) {
        const scale = safeWidth / bottomSum;
        result.bottomLeft.x *= scale;
        result.bottomRight.x *= scale;
      }
    }

    if (safeHeight <= 0) {
      result.topLeft.y = 0;
      result.topRight.y = 0;
      result.bottomRight.y = 0;
      result.bottomLeft.y = 0;
    } else {
      const leftSum = result.topLeft.y + result.bottomLeft.y;
      if (leftSum > safeHeight && leftSum > 0) {
        const scale = safeHeight / leftSum;
        result.topLeft.y *= scale;
        result.bottomLeft.y *= scale;
      }
      const rightSum = result.topRight.y + result.bottomRight.y;
      if (rightSum > safeHeight && rightSum > 0) {
        const scale = safeHeight / rightSum;
        result.topRight.y *= scale;
        result.bottomRight.y *= scale;
      }
    }

    return result;
  }

  private pathCommandsToPdf(commands: PathCommand[]): string[] | null {
    const result: string[] = [];
    for (const command of commands) {
      switch (command.type) {
        case "moveTo": {
          const point = this.pointToPdf({ x: command.x, y: command.y });
          if (!point) {
            return null;
          }
          result.push(`${point.x} ${point.y} m`);
          break;
        }
        case "lineTo": {
          const point = this.pointToPdf({ x: command.x, y: command.y });
          if (!point) {
            return null;
          }
          result.push(`${point.x} ${point.y} l`);
          break;
        }
        case "curveTo": {
          const cp1 = this.pointToPdf({ x: command.x1, y: command.y1 });
          const cp2 = this.pointToPdf({ x: command.x2, y: command.y2 });
          const end = this.pointToPdf({ x: command.x, y: command.y });
          if (!cp1 || !cp2 || !end) {
            return null;
          }
          result.push(`${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y} c`);
          break;
        }
        case "closePath":
          result.push("h");
          break;
        default:
          return null;
      }
    }
    return result;
  }

  private isZeroRadius(radii: Radius): boolean {
    return (
      radii.topLeft.x === 0 &&
      radii.topLeft.y === 0 &&
      radii.topRight.x === 0 &&
      radii.topRight.y === 0 &&
      radii.bottomRight.x === 0 &&
      radii.bottomRight.y === 0 &&
      radii.bottomLeft.x === 0 &&
      radii.bottomLeft.y === 0
    );
  }

 private roundedRectPath(width: number, height: number, radii: Radius, offsetX: number, offsetY: number): string[] {
    const commands: string[] = [];
    if (width <= 0 || height <= 0) {
      return commands;
    }
    const tl = radii.topLeft;
    const tr = radii.topRight;
    const br = radii.bottomRight;
    const bl = radii.bottomLeft;
    const k = 0.5522847498307936;

    const moveX = offsetX + tl.x;
    const moveY = offsetY;
    commands.push(`${formatNumber(moveX)} ${formatNumber(moveY)} m`);
    commands.push(`${formatNumber(offsetX + width - tr.x)} ${formatNumber(offsetY)} l`);

    if (tr.x > 0 || tr.y > 0) {
      const cp1x = offsetX + width - tr.x + k * tr.x;
      const cp1y = offsetY;
      const cp2x = offsetX + width;
      const cp2y = offsetY + tr.y - k * tr.y;
      const endX = offsetX + width;
      const endY = offsetY + tr.y;
      commands.push(
        `${formatNumber(cp1x)} ${formatNumber(cp1y)} ${formatNumber(cp2x)} ${formatNumber(cp2y)} ${formatNumber(endX)} ${formatNumber(endY)} c`,
      );
    } else {
      commands.push(`${formatNumber(offsetX + width)} ${formatNumber(offsetY)} l`);
    }

    commands.push(`${formatNumber(offsetX + width)} ${formatNumber(offsetY + height - br.y)} l`);

    if (br.x > 0 || br.y > 0) {
      const cp1x = offsetX + width;
      const cp1y = offsetY + height - br.y + k * br.y;
      const cp2x = offsetX + width - br.x + k * br.x;
      const cp2y = offsetY + height;
      const endX = offsetX + width - br.x;
      const endY = offsetY + height;
      commands.push(
        `${formatNumber(cp1x)} ${formatNumber(cp1y)} ${formatNumber(cp2x)} ${formatNumber(cp2y)} ${formatNumber(endX)} ${formatNumber(endY)} c`,
      );
    } else {
      commands.push(`${formatNumber(offsetX + width)} ${formatNumber(offsetY + height)} l`);
    }

    commands.push(`${formatNumber(offsetX + bl.x)} ${formatNumber(offsetY + height)} l`);

    if (bl.x > 0 || bl.y > 0) {
      const cp1x = offsetX + bl.x - k * bl.x;
      const cp1y = offsetY + height;
      const cp2x = offsetX;
      const cp2y = offsetY + height - bl.y + k * bl.y;
      const endX = offsetX;
      const endY = offsetY + height - bl.y;
      commands.push(
        `${formatNumber(cp1x)} ${formatNumber(cp1y)} ${formatNumber(cp2x)} ${formatNumber(cp2y)} ${formatNumber(endX)} ${formatNumber(endY)} c`,
      );
    } else {
      commands.push(`${formatNumber(offsetX)} ${formatNumber(offsetY + height)} l`);
    }

    commands.push(`${formatNumber(offsetX)} ${formatNumber(offsetY + tl.y)} l`);

    if (tl.x > 0 || tl.y > 0) {
      const cp1x = offsetX;
      const cp1y = offsetY + tl.y - k * tl.y;
      const cp2x = offsetX + tl.x - k * tl.x;
      const cp2y = offsetY;
      const endX = offsetX + tl.x;
      const endY = offsetY;
      commands.push(
        `${formatNumber(cp1x)} ${formatNumber(cp1y)} ${formatNumber(cp2x)} ${formatNumber(cp2y)} ${formatNumber(endX)} ${formatNumber(endY)} c`,
      );
    } else {
      commands.push(`${formatNumber(offsetX)} ${formatNumber(offsetY)} l`);
    }

    commands.push("h");
    return commands;
 }

  private transformForRect(rect: Rect): string {
    // If we're in a transform context, use relative coordinates
    if (this.transformContext) {
      const relX = rect.x - this.transformContext.x;
      const relY = rect.y - this.transformContext.y;
      const scaleX = this.coordinateTransformer.convertPxToPt(1);
      const scaleY = this.coordinateTransformer.convertPxToPt(1);
      const translateX = this.coordinateTransformer.convertPxToPt(relX);
      const translateY = this.coordinateTransformer.convertPxToPt(-relY); // Negative because PDF y-axis is flipped
      return `${formatNumber(scaleX)} 0 0 ${formatNumber(scaleY)} ${formatNumber(translateX)} ${formatNumber(translateY)} cm`;
    }
    
    // Normal absolute positioning
    const scaleX = this.coordinateTransformer.convertPxToPt(1);
    const scaleY = this.coordinateTransformer.convertPxToPt(1);
    const localY = rect.y - this.coordinateTransformer.pageOffsetPx;
    const translateX = this.coordinateTransformer.convertPxToPt(rect.x);
    const translateY = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY);
    return `${formatNumber(scaleX)} 0 0 ${formatNumber(-scaleY)} ${formatNumber(translateX)} ${formatNumber(translateY)} cm`;
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
    
    // If in transform context, use relative coordinates
    if (this.transformContext) {
      const relX = rect.x - this.transformContext.x;
      const relY = rect.y - this.transformContext.y;
      const x = this.coordinateTransformer.convertPxToPt(relX);
      const y = this.coordinateTransformer.convertPxToPt(-(relY + heightPx)); // Negative for PDF y-axis
      const width = this.coordinateTransformer.convertPxToPt(widthPx);
      const height = this.coordinateTransformer.convertPxToPt(heightPx);
      return {
        x: formatNumber(x),
        y: formatNumber(y),
        width: formatNumber(width),
        height: formatNumber(height),
      };
    }
    
    // Normal absolute positioning
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

  private pointToPdf(point: ShapePoint):
    | { x: string; y: string }
    | null {
    // If in transform context, use relative coordinates
    if (this.transformContext) {
      const relX = point.x - this.transformContext.x;
      const relY = point.y - this.transformContext.y;
      const x = this.coordinateTransformer.convertPxToPt(relX);
      const y = this.coordinateTransformer.convertPxToPt(-relY); // Negative for PDF y-axis
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return {
        x: formatNumber(x),
        y: formatNumber(y),
      };
    }
    
    // Normal absolute positioning
    const localY = point.y - this.coordinateTransformer.pageOffsetPx;
    const x = this.coordinateTransformer.convertPxToPt(point.x);
    const y = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return {
      x: formatNumber(x),
      y: formatNumber(y),
    };
  }

  private pointsToPdf(points: ShapePoint[]): Array<{ x: string; y: string }> | null {
    const result: Array<{ x: string; y: string }> = [];
    for (const point of points) {
      const converted = this.pointToPdf(point);
      if (!converted) {
        return null;
      }
      result.push(converted);
    }
    return result;
  }

  getResult(): ShapeRendererResult {
    return {
      commands: [...this.commands],
      shadings: this.gradientService.getShadings(),
    };
  }
}

function fillColorCommand(color: RGBA): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  // Alpha blending is handled through ExtGState assignments (see pushFillCommands).
  return `${r} ${g} ${b} rg`;
}

function strokeColorCommand(color: RGBA): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  return `${r} ${g} ${b} RG`;
}

function mapLineCap(cap: "butt" | "round" | "square" | undefined): number | undefined {
  switch (cap) {
    case "butt":
      return 0;
    case "round":
      return 1;
    case "square":
      return 2;
    default:
      return undefined;
  }
}

function mapLineJoin(join: "miter" | "round" | "bevel" | undefined): number | undefined {
  switch (join) {
    case "miter":
      return 0;
    case "round":
      return 1;
    case "bevel":
      return 2;
    default:
      return undefined;
  }
}

function resolveGradientPaint(paint: unknown): LinearGradient | RadialGradient | null {
  if (isLinearGradientPaint(paint) || isRadialGradientPaint(paint)) {
    return paint as LinearGradient | RadialGradient;
  }
  if (typeof paint === "string") {
    return parseLinearGradient(paint);
  }
  return null;
}

function isLinearGradientPaint(value: unknown): value is LinearGradient {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<LinearGradient>;
  return candidate.type === "linear" && Array.isArray((candidate as any).stops);
}

function isRadialGradientPaint(value: unknown): value is RadialGradient {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RadialGradient>;
  return candidate.type === "radial" && typeof (candidate as any).r === "number";
}

function normalizeChannel(value: number): number {
  if (value > 1) {
    return value / 255;
  }
 return value;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
