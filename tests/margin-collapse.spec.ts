import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import { TypographyDefaults } from "../src/css/browser-defaults.js";
import type { LayoutNode } from "../src/dom/node.js";

function findNodesByTag(root: LayoutNode, tag: string): LayoutNode[] {
  const matches: LayoutNode[] = [];
  root.walk((node) => {
    if (node.tagName?.toLowerCase() === tag) {
      matches.push(node);
    }
  });
  return matches;
}

function findNodeByTag(root: LayoutNode, tag: string): LayoutNode | undefined {
  return findNodesByTag(root, tag)[0];
}

describe("margin collapse", () => {
  it("collapses the top margin of the first block child with its parent", async () => {
    const html = `
      <html>
        <head>
          <style>
            body { margin: 0; }
          </style>
        </head>
        <body><div style="height: 10px;"></div><div>
            <h2>Introduction</h2>
            <p>Paragraph content.</p>
          </div></body>
      </html>
    `;

    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const divs = findNodesByTag(layoutRoot, "div");
    expect(divs.length).toBeGreaterThanOrEqual(2);
    const beforeNode = divs[0];
    const sectionNode = divs[1];
    const headingNode = findNodeByTag(layoutRoot, "h2");
    expect(headingNode).toBeDefined();
    if (!headingNode) {
      return;
    }

    const baseFont = TypographyDefaults.getFontSize();
    const expectedCollapsedMargin = baseFont * 1.5 * 0.83;

    const beforeBottom = beforeNode.box.y + beforeNode.box.borderBoxHeight;
    const gapToSection = sectionNode.box.y - beforeBottom;
    expect(gapToSection).toBeCloseTo(expectedCollapsedMargin, 2);

    const headingOffset = headingNode.box.y - sectionNode.box.y;
    expect(headingOffset).toBeCloseTo(0, 4);
  });
});
