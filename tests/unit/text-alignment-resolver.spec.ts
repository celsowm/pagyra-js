import { describe, it, expect } from "vitest";
import { LayoutNode } from "../../src/dom/node.js";
import { ComputedStyle } from "../../src/css/style.js";
import { Display, JustifyContent } from "../../src/css/enums.js";
import { resolveTextAlign, resolveFallbackStartX } from "../../src/pdf/utils/text-alignment-resolver.js";

describe("text-alignment-resolver", () => {
  it("walks ancestors to find explicit alignment", () => {
    const parent = new LayoutNode(new ComputedStyle({ textAlign: "center" }));
    const child = new LayoutNode(new ComputedStyle({ textAlign: "auto" }));
    parent.appendChild(child);

    expect(resolveTextAlign(child)).toBe("center");
  });

  it("calculates fallback start with text alignment and box width", () => {
    const node = new LayoutNode(new ComputedStyle({ textAlign: "right" }));
    node.box.x = 0;
    node.box.contentWidth = 100;

    const start = resolveFallbackStartX(node, 40, "right");
    expect(start).toBe(60);
  });

  it("uses flex alignment when the parent is a single-child flex container", () => {
    const parent = new LayoutNode(
      new ComputedStyle({
        display: Display.Flex,
        justifyContent: JustifyContent.Center,
        flexDirection: "row",
      }),
    );
    parent.box.x = 10;
    parent.box.contentWidth = 200;
    const child = new LayoutNode(new ComputedStyle({}));
    child.box.contentWidth = 200;
    parent.appendChild(child);

    const start = resolveFallbackStartX(child, 50);
    expect(start).toBe(10 + (200 - 50) / 2);
  });
});
