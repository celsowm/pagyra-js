import type { Viewport } from "../../geometry/box.js";

export interface LayoutEnvironmentOptions {
  viewport: Viewport;
}

export class LayoutEnvironment {
  constructor(private readonly options: LayoutEnvironmentOptions) {}

  get viewport(): Viewport {
    return this.options.viewport;
  }
}
