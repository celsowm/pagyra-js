import type { PdfObjectRef } from "../primitives/pdf-document.js";

export class GraphicsStateManager {
  private readonly fillAlphaStates = new Map<string, string>();
  private readonly graphicsStates = new Map<string, number>();

  ensureFillAlphaState(alpha: number): string {
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

  getGraphicsStates(): Map<string, number> {
    return new Map(this.graphicsStates);
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
}
