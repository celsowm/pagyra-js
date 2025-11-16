import { describe, it, expect } from "vitest";
import { LayoutNode } from "../../src/dom/node.js";
import { ComputedStyle } from "../../src/css/style.js";
import { resolveBackgroundLayers } from "../../src/pdf/utils/background-layer-resolver.js";

const baseBoxes = {
  borderBox: { x: 0, y: 0, width: 120, height: 120 },
  paddingBox: { x: 5, y: 5, width: 110, height: 110 },
  contentBox: { x: 10, y: 10, width: 100, height: 100 },
};

describe("background-layer-resolver", () => {
  it("resolves gradient layers and base color respecting origin and size", () => {
    const gradientLayer = {
      kind: "gradient" as const,
      gradient: { type: "linear" as const, stops: [{ color: "#fff" }] },
      origin: "content-box" as const,
      position: { x: "left", y: "top" },
      size: { width: "50px", height: "25px" },
    };
    const style = new ComputedStyle({
      backgroundLayers: [
        { kind: "color" as const, color: "#00ff00" },
        gradientLayer,
      ],
    });
    const node = new LayoutNode(style);

    const resolved = resolveBackgroundLayers(node, baseBoxes);

    expect(resolved.color).toEqual({ r: 0, g: 255, b: 0, a: 1 });
    expect(resolved.gradient?.rect).toEqual({ x: 10, y: 10, width: 50, height: 25 });
    expect(resolved.gradient?.originRect).toEqual(baseBoxes.contentBox);
  });

  it("skips image layers without info and uses available data when provided", () => {
    const style = new ComputedStyle({
      backgroundLayers: [
        {
          kind: "image" as const,
          origin: undefined,
          url: "data:img",
          resolvedUrl: "data:img",
          imageInfo: {
            width: 40,
            height: 20,
            format: "png" as const,
            channels: 4,
            bitsPerChannel: 8,
            data: new Uint8Array([0]).buffer,
          },
          position: { x: "right", y: "bottom" },
        },
      ],
    });
    const node = new LayoutNode(style);

    const resolved = resolveBackgroundLayers(node, baseBoxes);

    expect(resolved.image?.rect.width).toBe(40);
    expect(resolved.image?.rect.height).toBe(20);
    expect(resolved.image?.rect.x).toBe(baseBoxes.paddingBox.x + (baseBoxes.paddingBox.width - 40));
    expect(resolved.image?.rect.y).toBe(baseBoxes.paddingBox.y + (baseBoxes.paddingBox.height - 20));
    expect(resolved.image?.image.width).toBe(40);
  });

  it("defaults to padding-box origin when origin is not provided", () => {
    const style = new ComputedStyle({
      backgroundLayers: [
        {
          kind: "gradient" as const,
          gradient: { type: "linear" as const, stops: [{ color: "#000" }] },
        },
      ],
    });
    const node = new LayoutNode(style);

    const resolved = resolveBackgroundLayers(node, baseBoxes);

    expect(resolved.gradient?.originRect).toEqual(baseBoxes.paddingBox);
    expect(resolved.gradient?.rect?.x).toBe(baseBoxes.paddingBox.x);
    expect(resolved.gradient?.rect?.y).toBe(baseBoxes.paddingBox.y);
  });
});
