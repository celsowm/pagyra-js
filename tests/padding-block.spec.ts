import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { LayoutNode } from "../src/dom/node.js";

function findNodeByTag(root: LayoutNode, tag: string): LayoutNode | undefined {
  let match: LayoutNode | undefined;
  root.walk((node) => {
    if (node.tagName?.toLowerCase() === tag) {
      match = node;
    }
  });
  return match;
}

describe("padding-block", () => {
  it("should parse padding-block-start and padding-block-end", async () => {
    const html = `
      <html>
        <head>
          <style>
            div {
              padding-block-start: 10px;
              padding-block-end: 20px;
            }
          </style>
        </head>
        <body>
          <div>Hello</div>
        </body>
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

    const divNode = findNodeByTag(layoutRoot, "div");
    expect(divNode).toBeDefined();
    if (!divNode) {
      return;
    }

    expect(divNode.style.paddingTop).toBe(10);
    expect(divNode.style.paddingBottom).toBe(20);
  });
});
