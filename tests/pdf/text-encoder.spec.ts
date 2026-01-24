import { encodeTextPayload } from "../../src/pdf/renderers/text-encoder.js";
import type { FontResource } from "../../src/pdf/font/font-registry.js";
import { TtfFontMetrics } from "../../src/types/fonts.js";

describe("encodeTextPayload", () => {
  it("encodes Identity-H using glyph IDs", () => {
    const cmap = {
      getGlyphId: (codePoint: number) => (codePoint === 0x0041 ? 0x003d : 0x0123),
      hasCodePoint: (_codePoint: number) => true,
      unicodeMap: new Map<number, number>([
        [0x0041, 0x003d],
        [0x004f, 0x0123],
      ]),
    };

    const metrics = new TtfFontMetrics(
      {
        unitsPerEm: 1000,
        ascender: 0,
        descender: 0,
        lineGap: 0,
        capHeight: 0,
        xHeight: 0,
      },
      new Map(),
      cmap,
    );

    const font: FontResource = {
      baseFont: "TestFont",
      resourceName: "F1",
      ref: { objectNumber: 1 },
      isBase14: false,
      metrics,
    };

    const { encoded, scheme } = encodeTextPayload("A", font);
    expect(scheme).toBe("Identity-H");
    expect(encoded.length).toBe(2);
    expect(encoded.charCodeAt(0)).toBe(0x00);
    expect(encoded.charCodeAt(1)).toBe(0x3d);
  });
});
