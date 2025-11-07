import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { LayoutNode } from "../src/dom/node.js";

const renderDefaults = {
  viewportWidth: 600,
  viewportHeight: 800,
  pageWidth: 600,
  pageHeight: 800,
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
};

const LONG_WORD = "Supercalifragilisticexpialidocious";

function textNodesDirectChildrenOf(root: LayoutNode, tagName: string): LayoutNode[] {
  const matches: LayoutNode[] = [];
  root.walk((node) => {
    if (
      !node.tagName &&
      node.textContent &&
      node.parent?.tagName?.toLowerCase() === tagName.toLowerCase()
    ) {
      matches.push(node);
    }
  });
  return matches;
}

function findTextNodeByContent(root: LayoutNode, text: string): LayoutNode | undefined {
  let match: LayoutNode | undefined;
  root.walk((node) => {
    if (!node.tagName && node.textContent?.includes(text) && !match) {
      match = node;
    }
  });
  return match;
}

describe("overflow-wrap", () => {
  it("wraps oversized tokens only when overflow-wrap allows it", async () => {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial; }
            .box {
              width: 80px;
              font-size: 16px;
              line-height: 16px;
            }
            .force { overflow-wrap: anywhere; }
          </style>
        </head>
        <body>
          <div class="box default">${LONG_WORD}</div>
          <div class="box force">${LONG_WORD}</div>
        </body>
      </html>
    `;

    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      ...renderDefaults,
    });

    const textNodes = textNodesDirectChildrenOf(layoutRoot, "div");
    expect(textNodes.length).toBe(2);

    const [defaultNode, wrappedNode] = textNodes;
    expect(defaultNode.lineBoxes?.length).toBe(1);
    expect(wrappedNode.lineBoxes && wrappedNode.lineBoxes.length).toBeGreaterThan(1);
  });

  it("maps legacy word-wrap to overflow-wrap", async () => {
    const html = `<html><body><div style="word-wrap: break-word">${LONG_WORD}</div></body></html>`;
    const { layoutRoot } = await prepareHtmlRender({
      html,
      css: "",
      ...renderDefaults,
    });

    const textNode = findTextNodeByContent(layoutRoot, LONG_WORD);
    expect(textNode).toBeDefined();
    if (!textNode) {
      return;
    }

    expect(textNode.parent?.style.overflowWrap).toBe("break-word");
  });
});
