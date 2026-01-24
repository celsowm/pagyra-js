import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import { parseBackgroundImage } from "../../src/css/parsers/background-parser-extended.js";
import { ComputedStyle, type StyleAccumulator } from "../../src/css/style.js";
import { LayoutNode } from "../../src/dom/node.js";
import { resolveBackgroundLayers } from "../../src/pdf/utils/background-layer-resolver.js";
import type { RadialGradient } from "../../src/css/parsers/gradient-parser.js";

describe("radial-gradient backgrounds", () => {
  beforeAll(() => {
    registerAllPropertyParsers();
  });

  it("parses radial gradients into background layers", () => {
    const target: StyleAccumulator = {};
    parseBackgroundImage("radial-gradient(circle, #ffdd55, #ff6600)", target);

    expect(target.backgroundLayers).toBeDefined();
    const gradientLayer = target.backgroundLayers?.find((layer) => layer.kind === "gradient");
    expect(gradientLayer).toBeDefined();
    if (!gradientLayer || gradientLayer.kind !== "gradient") {
      throw new Error("Expected gradient background layer");
    }

    const gradient = gradientLayer.gradient as RadialGradient;
    expect(gradient.type).toBe("radial");
    expect(gradient.stops.length).toBe(2);
  });

  it("normalizes radial gradient geometry using farthest-corner default", () => {
    const target: StyleAccumulator = {};
    parseBackgroundImage("radial-gradient(circle, #ffdd55, #ff6600)", target);

    const style = new ComputedStyle({ backgroundLayers: target.backgroundLayers });
    const node = new LayoutNode(style);
    const boxes = {
      borderBox: { x: 0, y: 0, width: 300, height: 300 },
      paddingBox: { x: 0, y: 0, width: 300, height: 300 },
      contentBox: { x: 0, y: 0, width: 300, height: 300 },
    };

    const background = resolveBackgroundLayers(node, boxes);
    expect(background.gradient).toBeDefined();
    const gradient = background.gradient?.gradient as RadialGradient;
    expect(gradient.type).toBe("radial");
    expect(gradient.coordsUnits).toBe("ratio");
    expect(gradient.cx).toBeCloseTo(0.5, 3);
    expect(gradient.cy).toBeCloseTo(0.5, 3);

    const expectedRadiusRatio = Math.hypot(150, 150) / 300;
    expect(gradient.r).toBeCloseTo(expectedRadiusRatio, 3);
  });
});
