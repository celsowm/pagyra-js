import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { LayoutNode } from "../src/dom/node.js";

function findNode(root: LayoutNode, tagName: string): LayoutNode {
  let result: LayoutNode | undefined;
  root.walk((node) => {
    if (result) {
      return;
    }
    if (node.tagName?.toLowerCase() === tagName) {
      result = node;
    }
  });
  if (!result) {
    throw new Error(`Unable to locate <${tagName}> in layout tree`);
  }
  return result;
}

async function renderElement(html: string, css: string) {
  const { layoutRoot } = await prepareHtmlRender({
    html: `<html><body>${html}</body></html>`,
    css,
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 800,
    pageHeight: 600,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  return layoutRoot;
}

describe("Background images", () => {
  it("stores background-image layers with url, position, repeat and size", async () => {
    const root = await renderElement(
      '<div class="with-bg">conteúdo</div>',
      '.with-bg { width: 120px; height: 80px; background-image: url(example.png); background-size: cover; }'
    );
    const div = findNode(root, "div");

    expect(div.style.backgroundLayers).toBeDefined();
    const imageLayer = div.style.backgroundLayers?.find((layer) => layer.kind === "image");
    expect(imageLayer).toBeDefined();

    if (!imageLayer) {
      return;
    }

    expect(imageLayer.url).toBe("url(example.png)");
    expect(imageLayer.position).toEqual({ x: "left", y: "top" });
    expect(imageLayer.repeat).toBe("repeat");
    expect(imageLayer.size).toBe("cover");
  });

  const sizeCases: Array<[string, "cover" | "contain" | "auto" | { width: string; height: string }]> = [
    ["cover", "cover"],
    ["Cover", "cover"],
    ["Cover (fills entire area)", "cover"],
    ["contain", "contain"],
    ["Contain (fits within area)", "contain"],
    ["auto", "auto"],
    ["Auto (original size)", "auto"],
    ["50% 50%", { width: "50%", height: "50%" }],
  ];

  for (const [value, expected] of sizeCases) {
    it(`normalizes background-size value "${value}"`, async () => {
      const root = await renderElement(
        '<div class="with-bg">conteúdo</div>',
        `.with-bg { width: 120px; height: 80px; background-image: url(example.png); background-size: ${value}; }`
      );
      const div = findNode(root, "div");
      const imageLayer = div.style.backgroundLayers?.find((layer) => layer.kind === "image");
      expect(imageLayer).toBeDefined();
      if (!imageLayer) {
        return;
      }

      if (typeof expected === "string") {
        expect(imageLayer.size).toBe(expected);
      } else {
        expect(imageLayer.size).toEqual(expected);
      }
    });
  }
  it("applies size and position longhands to gradient backgrounds", async () => {
    const css = `
      .probe {
        width: 160px;
        height: 60px;
        background: linear-gradient(90deg, rgba(40, 127, 249, 0.12) 0, transparent 0) repeat-y;
        background-size: 1px 100%;
        background-position: 0 0;
      }
    `;
    const root = await renderElement('<div class="probe">text</div>', css);
    const div = findNode(root, "div");
    const gradientLayer = div.style.backgroundLayers?.find((layer) => layer.kind === "gradient");
    expect(gradientLayer).toBeDefined();
    if (!gradientLayer) {
      return;
    }
    expect(gradientLayer.repeat).toBe("repeat-y");
    expect(gradientLayer.size).toEqual({ width: "1px", height: "100%" });
    expect(gradientLayer.position).toEqual({ x: "0", y: "0" });
  });

});
