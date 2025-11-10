import type { Viewport } from "../../geometry/box.js";
import type { FontEmbedder } from "../../pdf/font/embedder.js";

export interface LayoutEnvironmentOptions {
  viewport: Viewport;
  fontEmbedder: FontEmbedder | null;
}

export class LayoutEnvironment {
  constructor(private readonly options: LayoutEnvironmentOptions) {}

  get viewport(): Viewport {
    return this.options.viewport;
  }

  get fontEmbedder(): FontEmbedder | null {
    return this.options.fontEmbedder;
  }
}
