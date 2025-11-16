import type { FontRegistry, FontResource } from "../font/font-registry.js";
import { needsUnicode } from "../../text/text.js";

export interface TextFontResolveOptions {
  readonly fontFamily?: string;
  readonly fontWeight?: number;
  readonly fontStyle?: string;
  readonly fontVariant?: string;
  readonly text?: string;
}

export class TextFontResolver {
  constructor(private readonly fontRegistry: FontRegistry) {}

  async ensureFontResource(options: TextFontResolveOptions): Promise<FontResource> {
    const text = options.text ?? "";
    const requiresUnicode = needsUnicode(text);
    let resource = await this.fontRegistry.ensureFontResource(options.fontFamily, options.fontWeight, options.fontStyle);

    if (requiresUnicode && resource.isBase14) {
      const fallback = await this.fontRegistry.ensureFontResource(undefined, options.fontWeight, options.fontStyle);
      if (!fallback.isBase14) {
        resource = fallback;
      }
    }

    return resource;
  }
}
