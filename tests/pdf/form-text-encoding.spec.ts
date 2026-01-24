import { InputTextRenderer } from "../../src/pdf/renderers/form/input-text-renderer.js";
import type { FontProvider } from "../../src/pdf/renderers/form/irenderer.js";
import { TtfFontMetrics } from "../../src/types/fonts.js";
import { NodeKind, Overflow } from "../../src/pdf/types.js";

describe("form text encoding", () => {
  it("uses identity encoding when a non-base14 font is provided", () => {
    const glyphMap = new Map<number, number>([
      ["A".codePointAt(0)!, 0x0102],
      ["B".codePointAt(0)!, 0x0103],
    ]);
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
      {
        getGlyphId: (codePoint: number) => glyphMap.get(codePoint) ?? 0,
        hasCodePoint: (codePoint: number) => glyphMap.has(codePoint),
        unicodeMap: new Map(glyphMap),
      },
    );
    const fontProvider: FontProvider = {
      ensureFontResourceSync: () => ({
        baseFont: "FakeFont",
        resourceName: "F9",
        ref: { objectNumber: 9 },
        isBase14: false,
        metrics,
      }),
    };

    const renderer = new InputTextRenderer();
    const result = renderer.render(
      {
        tagName: "input",
        id: "input-1",
        kind: NodeKind.Container,
        contentBox: { x: 0, y: 0, width: 100, height: 20 },
        paddingBox: { x: 0, y: 0, width: 100, height: 20 },
        borderBox: { x: 0, y: 0, width: 100, height: 20 },
        visualOverflow: { x: 0, y: 0, width: 100, height: 20 },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        border: { top: 1, right: 1, bottom: 1, left: 1 },
        borderRadius: {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 0, y: 0 },
          bottomRight: { x: 0, y: 0 },
          bottomLeft: { x: 0, y: 0 },
        },
        background: {},
        opacity: 1,
        overflow: Overflow.Visible,
        textRuns: [],
        decorations: {},
        textShadows: [],
        boxShadows: [],
        establishesStackingContext: false,
        zIndexComputed: 0,
        positioning: { type: "normal" },
        children: [],
        links: [],
        customData: {
          formControl: {
            kind: "input",
            inputType: "text",
            value: "AB",
          },
          fontSize: 14,
        },
      },
      {
        coordinateTransformer: {
          convertPxToPt: (value: number) => value,
          pageOffsetPx: 0,
          pageHeightPt: 1000,
        },
        graphicsStateManager: {
          ensureFillAlphaState: () => "GS0",
        },
        fontResolver: {
          resolveFont: (family: string) => family,
        },
        fontProvider,
      },
    );

    const fontCommand = result.commands.find((cmd) => cmd.includes(" Tf"));
    expect(fontCommand).toContain("/F9");

    const textCommand = result.commands.find((cmd) => cmd.endsWith(" Tj"));
    expect(textCommand).toBeDefined();
    const match = textCommand?.match(/^\((.*)\) Tj$/);
    expect(match).not.toBeNull();
    if (!match) return;
    expect(match[1].length).toBe(4);
  });
});
