import type { RenderBox } from "../../types.js";
import type { FontResource } from "../../font/font-registry.js";
import type { FormControlData } from "./types.js";

export interface FontProvider {
  ensureFontResourceSync(family: string | undefined, weight?: number, style?: string): FontResource;
}

export interface RenderContext {
  readonly coordinateTransformer: {
    convertPxToPt(value: number): number;
    pageOffsetPx: number;
    pageHeightPt: number;
  };
  readonly graphicsStateManager: {
    ensureFillAlphaState(alpha: number): string;
  };
  readonly fontResolver: {
    resolveFont(family: string, weight: number, style: string): string;
  };
  readonly fontProvider: FontProvider;
}

export interface RenderCommands {
  readonly commands: string[];
  readonly shadings: Map<string, string>;
  readonly resources?: {
    readonly images?: Map<string, unknown>;
    readonly fonts?: Set<string>;
  };
}

export interface IFormRenderer {
  readonly elementType: string;
  canRender(node: RenderBox): boolean;
  render(node: RenderBox, context: RenderContext): RenderCommands;
  getFormControlData(node: RenderBox): FormControlData | null;
}
