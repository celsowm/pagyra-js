import type { Viewport } from "../../geometry/box.js";
import type { FontEmbedder } from "../../pdf/font/embedder.js";
import type { Environment } from "../../environment/environment.js";

export interface LayoutEnvironmentOptions {
  viewport: Viewport;
  fontEmbedder: FontEmbedder | null;
  getEnv?: Environment["getEnv"];
}

export class LayoutEnvironment {
  private readonly envAccessor: Environment["getEnv"];

  constructor(private readonly options: LayoutEnvironmentOptions) {
    this.envAccessor = options.getEnv ?? (() => undefined);
  }

  get viewport(): Viewport {
    return this.options.viewport;
  }

  get fontEmbedder(): FontEmbedder | null {
    return this.options.fontEmbedder;
  }

  getEnv(name: string): string | undefined {
    return this.envAccessor(name);
  }
}
