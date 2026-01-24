import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import {
  parseBackgroundImage,
  applyBackgroundClipDecl,
} from "../../src/css/parsers/background-parser-extended.js";
import { resolveTextGradientLayer } from "../../src/pdf/utils/background-layer-resolver.js";
import { ComputedStyle } from "../../src/css/style.js";
import { LayoutNode } from "../../src/dom/node.js";
import type { StyleAccumulator } from "../../src/css/style.js";
import type { GradientBackgroundLayer } from "../../src/css/background-types.js";
describe("background-clip CSS handling", () => {
  beforeAll(() => {
    registerAllPropertyParsers();
  });

  it("marks gradients with background-clip: text", () => {
    const target: StyleAccumulator = {};
    parseBackgroundImage("linear-gradient(red, blue)", target);
    applyBackgroundClipDecl("text", target);

    expect(target.backgroundLayers).toBeDefined();
    const gradientLayer = target.backgroundLayers?.find((layer) => layer.kind === "gradient");
    expect(gradientLayer).toBeDefined();
    expect(gradientLayer?.clip).toBe("text");
  });

  it("resolveTextGradientLayer returns gradient data for text clips", () => {
    const style = new ComputedStyle();
    style.backgroundLayers = [
      {
        kind: "gradient",
        gradient: {
          type: "linear",
          angleOrTo: "to right",
          stops: [
            { color: "#ff0000" },
            { color: "#0000ff" },
          ],
        },
        clip: "text",
      },
    ] as GradientBackgroundLayer[];

    const node = new LayoutNode(style);
    const boxes = {
      borderBox: { x: 0, y: 0, width: 200, height: 50 },
      paddingBox: { x: 0, y: 0, width: 200, height: 50 },
      contentBox: { x: 0, y: 0, width: 200, height: 50 },
    };

    const result = resolveTextGradientLayer(node, boxes);
    expect(result).toBeDefined();
    expect(result?.rect.width).toBeGreaterThan(0);
    expect(result?.gradient).toBeDefined();
  });
});
