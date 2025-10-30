import type { RGBA, Rect, Radius } from "../types.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import { GradientService } from "../shading/gradient-service.js";
import { parseLinearGradient, type LinearGradient } from "../../css/parsers/gradient-parser.js";

export interface ShapeRendererResult {
  readonly commands: string[];
}

export class ShapeRenderer {
  private readonly commands: string[] = [];
  private readonly fillAlphaStates = new Map<string, string>();
  private readonly graphicsStates = new Map<string, number>();
  private readonly gradientService: GradientService;

  constructor(
    private readonly coordinateTransformer: CoordinateTransformer,
  ) {
    this.gradientService = new GradientService(coordinateTransformer);
  }

  drawBoxOutline(rect: Rect, color: RGBA = { r: 0.85, g: 0.85, b: 0.85, a: 1 }): void {
    this.strokeRect(rect, color);
  }

  drawFilledBox(rect: Rect, color: RGBA): void {
    this.fillRect(rect, color);
  }

  fillRoundedRect(rect: Rect, radii: Radius, color: RGBA | string): void {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return;
    }
    
    // Debug: Log the color parameter
    console.log("fillRoundedRect called with:", typeof color, color);
    
    // Check if color is a gradient string
    if (typeof color === 'string') {
      console.log("Processing gradient string:", color);
      this.fillRoundedRectWithGradient(rect, radii, color);
      return;
    }
    
    const adjusted = this.normalizeRadiiForRect(width, height, radii);
    if (this.isZeroRadius(adjusted)) {
      this.fillRect(rect, color);
      return;
    }
    const path = this.roundedRectPath(width, height, adjusted, 0, 0);
    if (path.length === 0) {
      return;
    }
    const commands = [this.transformForRect(rect), ...path, "f"];
    this.pushFillCommands(color, commands, true);
  }

  // Allow low-level injection of drawing commands to preserve ordering (used for raster shadows)
  pushRawCommands(commands: string[]): void {
    if (!Array.isArray(commands) || commands.length === 0) return;
    this.commands.push(...commands);
  }

  private fillRoundedRectWithGradient(rect: Rect, radii: Radius, gradientStr: string): void {
    const gradient = parseLinearGradient(gradientStr);
    if (!gradient) {
      // If gradient parsing fails, fall back to a default color
      this.fillRoundedRect(rect, radii, { r: 0, g: 0, b: 0, a: 1 });
      return;
    }

    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return;
    }

    const adjusted = this.normalizeRadiiForRect(width, height, radii);
    if (this.isZeroRadius(adjusted)) {
      // Use gradient for rectangle if radius is zero
      this.fillRectWithGradient(rect, `linear-gradient(${gradient.direction || 'to right'}, ${gradient.stops.map(s => s.color).join(', ')})`);
      return;
    }

    const path = this.roundedRectPath(width, height, adjusted, 0, 0);
    if (path.length === 0) {
      return;
    }

    const gradientPattern = this.gradientService.createLinearGradient(gradient, rect);
    const patternName = gradientPattern.patternName;
    
    // Set up the fill pattern
    const commands = [
      this.transformForRect(rect),
      ...path,
      `/${patternName} scn`
    ];

    // Push with isolation
    this.commands.push("q");
    this.commands.push(...commands);
    this.commands.push("Q");
  }

  private fillRectWithGradient(rect: Rect, gradientStr: string): void {
    const gradient = parseLinearGradient(gradientStr);
    if (!gradient) {
      // If gradient parsing fails, fall back to a default color
      const pdfRect = this.rectToPdf(rect);
      if (!pdfRect) {
        return;
      }
      const commands = [`${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "f"];
      this.pushFillCommands({ r: 0, g: 0, b: 0, a: 1 }, commands, false);
      return;
    }

    const pdfRect = this.rectToPdf(rect);
    if (!pdfRect) {
      return;
    }

    const gradientPattern = this.gradientService.createLinearGradient(gradient, rect);
    const patternName = gradientPattern.patternName;
    
    // Set up the fill pattern for rectangle
    const commands = [
      "/Pattern cs",
      `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`,
      `/${patternName} scn`
    ];

    // Push with isolation
    this.commands.push("q");
    this.commands.push(...commands);
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

  fillRect(rect: Rect, color: RGBA | string): void {
    // Check if color is a gradient string
    if (typeof color === 'string') {
      this.fillRectWithGradient(rect, color);
      return;
    }
    
    const pdfRect = this.rectToPdf(rect);
    if (!pdfRect) {
      return;
    }
    const commands = [`${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "f"];
    this.pushFillCommands(color, commands, false);
  }

  strokeRect(rect: Rect, color: RGBA): void {
    const pdfRect = this.rectToPdf(rect);
    if (!pdfRect) {
      return;
    }
    this.commands.push(strokeColorCommand(color), `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "S");
  }

  private pushFillCommands(color: RGBA, commands: string[], wrapWithQ: boolean): void {
    const alpha = this.normalizeAlpha(color.a);
    const hasAlpha = alpha < 1;
    const baseColor: RGBA = { r: color.r, g: color.g, b: color.b, a: alpha };
    const needsIsolation = wrapWithQ || hasAlpha;
    this.commands.push(fillColorCommand(baseColor));
    if (needsIsolation) {
      this.commands.push("q");
    }
    if (hasAlpha) {
      const state = this.ensureFillAlphaState(alpha);
      this.commands.push(`/${state} gs`);
    }
    this.commands.push(...commands);
    if (needsIsolation) {
      this.commands.push("Q");
    }
  }

  private ensureFillAlphaState(alpha: number): string {
    const normalized = this.normalizeAlpha(alpha);
    const key = normalized.toFixed(4);
    const existing = this.fillAlphaStates.get(key);
    if (existing) {
      return existing;
    }
    const name = `GS${this.fillAlphaStates.size}`;
    const numeric = Number.parseFloat(key);
    this.fillAlphaStates.set(key, name);
    this.graphicsStates.set(name, numeric);
    return name;
 }

  private normalizeAlpha(alpha: number | undefined): number {
    if (!Number.isFinite(alpha ?? NaN)) {
      return 1;
    }
    if (alpha === undefined) {
      return 1;
    }
    if (alpha <= 0) {
      return 0;
    }
    if (alpha >= 1) {
      return 1;
    }
    return alpha;
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

  getResult(): ShapeRendererResult {
    // Include gradient patterns in the result
    const gradientCommands = this.gradientService.getPatternCommands();
    return {
      commands: [...this.commands, ...gradientCommands],
    };
  }
}

function fillColorCommand(color: RGBA): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  if (color.a !== undefined && color.a < 1) {
    // Transparency is not directly supported; ignore alpha for now.
  }
  return `${r} ${g} ${b} rg`;
}

function strokeColorCommand(color: RGBA): string {
  const r = formatNumber(normalizeChannel(color.r));
  const g = formatNumber(normalizeChannel(color.g));
  const b = formatNumber(normalizeChannel(color.b));
  return `${r} ${g} ${b} RG`;
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
