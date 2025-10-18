import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import { TypographyDefaults } from "../src/css/browser-defaults.js";
import type { LayoutNode } from "../src/dom/node.js";

const baseFontSize = TypographyDefaults.getFontSize();

function findNodeByTag(root: LayoutNode, tag: string): LayoutNode | undefined {
  let match: LayoutNode | undefined;
  root.walk((node) => {
    if (match) {
      return;
    }
    if (node.tagName?.toLowerCase() === tag) {
      match = node;
    }
  });
  return match;
}

function renderHeadingStyle(tag: string) {
  const { layoutRoot } = prepareHtmlRender({
    html: `<html><body><${tag}>Heading</${tag}></body></html>`,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 800,
    pageHeight: 600,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const node = findNodeByTag(layoutRoot, tag);
  expect(node, `Failed to find ${tag} node in layout tree`).toBeDefined();
  return node!.style;
}

describe("heading UA defaults", () => {
  const cases = [
    { tag: "h1", fontMultiplier: 2, marginMultiplier: 0.67 },
    { tag: "h2", fontMultiplier: 1.5, marginMultiplier: 0.83 },
    { tag: "h3", fontMultiplier: 1.17, marginMultiplier: 1 },
    { tag: "h4", fontMultiplier: 1, marginMultiplier: 1.33 },
    { tag: "h5", fontMultiplier: 0.83, marginMultiplier: 1.67 },
    { tag: "h6", fontMultiplier: 0.67, marginMultiplier: 2.33 },
  ] as const;

  for (const { tag, fontMultiplier, marginMultiplier } of cases) {
    it(`applies UA defaults to <${tag}>`, () => {
      const style = renderHeadingStyle(tag);
      const expectedFontSize = baseFontSize * fontMultiplier;
      const expectedMargin = expectedFontSize * marginMultiplier;

      expect(style.fontWeight).toBe(700);
      expect(style.fontSize).toBeCloseTo(expectedFontSize, 5);
      expect(Number(style.marginTop)).toBeCloseTo(expectedMargin, 5);
      expect(Number(style.marginBottom)).toBeCloseTo(expectedMargin, 5);
      expect(Number(style.marginLeft)).toBeCloseTo(0, 5);
      expect(Number(style.marginRight)).toBeCloseTo(0, 5);
    });
  }
});
