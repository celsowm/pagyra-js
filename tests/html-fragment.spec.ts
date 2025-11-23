import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { LayoutNode } from "../src/dom/node.js";

function findNodeByTag(root: LayoutNode, tag: string): LayoutNode | undefined {
  let match: LayoutNode | undefined;
  root.walk((node) => {
    if (!match && node.tagName?.toLowerCase() === tag) {
      match = node;
    }
  });
  return match;
}

function collectText(node: LayoutNode): string {
  let text = "";
  node.walk((child) => {
    if (child.textContent) {
      text += child.textContent;
    }
  }, false);
  return text;
}

describe("HTML fragments are normalized", () => {
  it("wraps fragments so body children are rendered", async () => {
    const fragment = `<h2>Lorem ipsum dolor sit amet</h2>
<p>
  Lorem ipsum dolor sit amet, consectetur adipiscing elit.
  <strong>Praesent consequat</strong> urna ut justo pulvinar.
</p>`;

    const { layoutRoot } = await prepareHtmlRender({
      html: fragment,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    expect(layoutRoot.tagName?.toLowerCase()).toBe("body");

    const h2 = findNodeByTag(layoutRoot, "h2");
    expect(h2, "expected h2 to be present in layout tree").toBeDefined();
    expect(collectText(h2!)).toContain("Lorem ipsum dolor sit amet");

    const p = findNodeByTag(layoutRoot, "p");
    expect(p, "expected paragraph to be present in layout tree").toBeDefined();
    expect(collectText(p!)).toContain("Praesent consequat");
  });
});
