import { describe, it, expect } from "vitest";
import { ComputedStyle } from "../../src/css/style.js";
import { applyBackgroundOrigin, parseBackgroundShorthand } from "../../src/css/parsers/background-parser.js";
import { resolveBackgroundLayers } from "../../src/pdf/utils/background-layer-resolver.js";
import { LayoutNode } from "../../src/dom/node.js";

describe("background-origin parsing and resolution", () => {
  it("applies background-origin longhand to top renderable layer", () => {
    const style = new ComputedStyle({
      backgroundLayers: [
        { kind: "color", color: "#fff" },
        { kind: "image", url: "url(foo.png)" },
      ],
    });

    applyBackgroundOrigin(style, "content-box");

    expect(style.backgroundLayers?.[1]).toMatchObject({ origin: "content-box" });
  });

  it("parses background shorthand with box keyword as origin", () => {
    const style = new ComputedStyle();

    const layers = parseBackgroundShorthand("url(foo.png) no-repeat border-box");
    style.backgroundLayers = layers;

    expect(style.backgroundLayers?.[0]).toMatchObject({
      kind: "image",
      origin: "border-box",
    });
  });

  it("resolves origin rects correctly for different origins", () => {
    const baseBoxes = {
      borderBox: { x: 0, y: 0, width: 120, height: 120 },
      paddingBox: { x: 5, y: 5, width: 110, height: 110 },
      contentBox: { x: 10, y: 10, width: 100, height: 100 },
    };

    const style = new ComputedStyle({
      backgroundLayers: [
        {
          kind: "gradient" as const,
          gradient: { type: "linear" as const, stops: [{ color: "#000" }] },
          origin: "content-box" as const,
        },
      ],
    });
    const node = new LayoutNode(style);

    const resolved = resolveBackgroundLayers(node, baseBoxes);

    expect(resolved.gradient?.originRect).toEqual(baseBoxes.contentBox);
  });
});
