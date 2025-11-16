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
    const familiesToTry: (string | undefined)[] = [];

    if (options.fontFamily) {
      familiesToTry.push(options.fontFamily);
    }

    if (requiresUnicode) {
      const fallbackStack = this.fontRegistry.getDefaultFontStack();
      for (const family of fallbackStack) {
        if (family && family.length > 0) {
          familiesToTry.push(family);
        }
      }
    }

    familiesToTry.push(undefined);

    const seen = new Set<string>();
    const attempted: FontResource[] = [];

    for (const family of familiesToTry) {
      const key = family ?? "__default__";
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const resource = await this.fontRegistry.ensureFontResource(family, options.fontWeight, options.fontStyle);
      attempted.push(resource);

      if (fontSupportsText(resource, text, requiresUnicode)) {
        return resource;
      }
    }

    return attempted[attempted.length - 1]!;
  }
}

function fontSupportsText(font: FontResource, text: string, requiresUnicode: boolean): boolean {
  if (!text) {
    return true;
  }
  if (!font.metrics) {
    return !requiresUnicode;
  }
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    const glyphId = font.metrics.cmap.getGlyphId(codePoint);
    if (glyphId === 0) {
      return false;
    }
  }
  return true;
}
