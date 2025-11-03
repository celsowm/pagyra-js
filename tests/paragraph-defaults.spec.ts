import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { LayoutNode } from "../src/dom/node.js";

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

describe("paragraph UA defaults", () => {
  it("applies zero horizontal margin and 16px vertical margins to <p>", async () => {
    const { layoutRoot } = await prepareHtmlRender({
      html: "<html><body><p>Paragraph</p></body></html>",
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const paragraphNode = findNodeByTag(layoutRoot, "p");
    expect(paragraphNode, "Failed to find <p> node in layout tree").toBeDefined();

    const style = paragraphNode!.style;

    expect(Number(style.marginLeft)).toBeCloseTo(0, 5);
    expect(Number(style.marginRight)).toBeCloseTo(0, 5);
    expect(Number(style.marginTop)).toBeCloseTo(16, 5);
    expect(Number(style.marginBottom)).toBeCloseTo(16, 5);
  });
});
