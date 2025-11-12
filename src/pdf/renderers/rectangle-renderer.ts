import type { RGBA, Rect, Radius } from "../types.js";
import { CoordinateTransformer } from "../utils/coordinate-transformer.js";
import { GradientService } from "../shading/gradient-service.js";
import type { LinearGradient, RadialGradient } from "../../css/parsers/gradient-parser.js";
import type { GraphicsStateManager } from "./graphics-state-manager.js";
import { strokeColorCommand, fillColorCommand, rectToPdf, formatNumber, resolveGradientPaint, transformForRect } from "./shape-utils.js";

export class RectangleRenderer {
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

  fillRoundedRect(_rect: Rect, _radii: Radius, _paint: RGBA | LinearGradient | RadialGradient | string): void {
    // Implementation moved from ShapeRenderer
  }

  strokeRect(rect: Rect, color: RGBA): void {
    const pdfRect = rectToPdf(rect, this.coordinateTransformer, this.transformContext);
    if (!pdfRect) {
      return;
    }
    this.commands.push(strokeColorCommand(color), `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "S");
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

    const pdfRect = rectToPdf(rect, this.coordinateTransformer, this.transformContext);
    if (!pdfRect) {
      return;
    }
    const commands = [`${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "f"];
    this.pushFillCommands(paint as RGBA, commands, false);
  }

  fillRoundedRectDifference(_outerRect: Rect, _outerRadii: Radius, _innerRect: Rect, _innerRadii: Radius, _color: RGBA): void {
    // Implementation moved from ShapeRenderer
  }

  // Helper methods

  private fillRectWithGradient(rect: Rect, gradient: LinearGradient): void {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return;
    }

    const shading = this.gradientService.createLinearGradient(gradient, rect);
    this.commands.push("q");
    this.commands.push(transformForRect(rect, this.coordinateTransformer, this.transformContext));
    this.commands.push(`0 0 ${formatNumber(width)} ${formatNumber(height)} re`);
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
    this.commands.push(transformForRect(rect, this.coordinateTransformer, this.transformContext));
    this.commands.push(`0 0 ${formatNumber(width)} ${formatNumber(height)} re`);
    this.commands.push("W n");
    this.commands.push(`/${shading.shadingName} sh`);
    this.commands.push("Q");
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


}
