import { renderTreeForHtml, collectBoxes } from "../helpers/render-utils.js";
import { InputTextRenderer } from "../../src/pdf/renderers/form/input-text-renderer.js";
import type { RenderBox } from "../../src/pdf/types.js";
import type { FontResource } from "../../src/pdf/font/font-registry.js";
import type { FontProvider } from "../../src/pdf/renderers/form/irenderer.js";

function extractRgb(command: string): number[] | null {
  const parts = command.trim().split(/\s+/);
  const op = parts[parts.length - 1];
  if (op !== "rg" && op !== "RG") {
    return null;
  }
  if (parts.length < 4) {
    return null;
  }
  const values = parts.slice(-4, -1).map((value) => Number.parseFloat(value));
  if (values.some((value) => Number.isNaN(value))) {
    return null;
  }
  return values;
}

describe("form renderer color normalization", () => {
  it("normalizes RGB channels for input text rendering", async () => {
    const html = `<input type="text" value="John Doe">`;
    const css = `
      body { color: #333; }
      input[type="text"] { border: 1px solid #ddd; background: #fff; }
    `;
    const renderTree = await renderTreeForHtml(html, css);
    const boxes = collectBoxes(renderTree.root);
    const inputBox = boxes.find((box) => box.tagName === "input") as RenderBox | undefined;
    expect(inputBox).toBeDefined();

    const renderer = new InputTextRenderer();
    const fontProvider: FontProvider = {
      ensureFontResourceSync: () =>
        ({
          baseFont: "Helvetica",
          resourceName: "F1",
          ref: { objectNumber: 1 },
          isBase14: true,
        }) as FontResource,
    };
    const result = renderer.render(inputBox!, {
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
    });

    const rgbValues = result.commands
      .map(extractRgb)
      .filter((values): values is number[] => values !== null);

    expect(rgbValues.length).toBeGreaterThan(0);
    for (const values of rgbValues) {
      for (const channel of values) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});
