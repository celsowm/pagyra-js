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

describe("CSS property ordering and edge cases", () => {
  it("handles longhand border-left-width after border shorthand", async () => {
    const root = await renderElement(
      '<div class="test">Test</div>',
      '.test { border: none; border-left-width: 5px; }'
    );
    const div = findNode(root, "div");

    // border: none should set all borders to 0, but border-left-width: 5px should override left border
    expect(div.style.borderTop ?? 0).toBe(0);
    expect(div.style.borderRight ?? 0).toBe(0);
    expect(div.style.borderBottom ?? 0).toBe(0);
    expect(div.style.borderLeft).toBeCloseTo(5);
  });

  it("handles background-size longhand after background shorthand", async () => {
    const root = await renderElement(
      '<div class="test">Test</div>',
      '.test { background: linear-gradient(red, blue), url(test.jpg); background-size: cover; }'
    );
    const div = findNode(root, "div");

    // Should have background layers and the size should be applied to the top renderable layer
    expect(div.style.backgroundLayers).toBeDefined();
    expect(div.style.backgroundLayers!.length).toBeGreaterThan(0);
  });

  it("handles text-decoration-line longhand after text-decoration shorthand", async () => {
    const root = await renderElement(
      '<div class="test">Test</div>',
      '.test { text-decoration: underline; text-decoration-line: line-through; }'
    );
    const div = findNode(root, "div");

    // Last declaration should win
    expect(div.style.textDecorationLine).toBe("line-through");
  });

  it("handles specificity ordering with multiple rules", async () => {
    const root = await renderElement(
      '<div class="test">Test</div>',
      `
        div { border: 1px solid red; }
        .test { border: 2px solid blue; }
      `
    );
    const div = findNode(root, "div");

    // Higher specificity rule should win
    expect(div.style.borderTop).toBeCloseTo(2);
    expect(div.style.borderColor).toBe("blue");
  });

  it("handles inline styles overriding CSS rules", async () => {
    const root = await renderElement(
      '<div class="test" style="border: 3px solid green;">Test</div>',
      '.test { border: 2px solid blue; }'
    );
    const div = findNode(root, "div");

    // Inline styles should have highest priority
    expect(div.style.borderTop).toBeCloseTo(3);
    expect(div.style.borderColor).toBe("green");
  });

  it("handles case-insensitive property names", async () => {
    const root = await renderElement(
      '<div class="test">Test</div>',
      '.test { BORDER: 2px solid blue; MARGIN-TOP: 10px; }'
    );
    const div = findNode(root, "div");

    // Property names should be normalized to lowercase
    expect(div.style.borderTop).toBeCloseTo(2);
    expect(div.style.borderColor).toBe("blue");
    expect(div.style.marginTop).toBeCloseTo(10);
  });

  it("handles shorthand followed by longhand for margin", async () => {
    const root = await renderElement(
      '<div class="test">Test</div>',
      '.test { margin: 10px; margin-top: 20px; }'
    );
    const div = findNode(root, "div");

    // Longhand should override shorthand
    expect(div.style.marginTop).toBeCloseTo(20);
    expect(div.style.marginRight).toBeCloseTo(10);
    expect(div.style.marginBottom).toBeCloseTo(10);
    expect(div.style.marginLeft).toBeCloseTo(10);
  });

  it("handles shorthand followed by longhand for padding", async () => {
    const root = await renderElement(
      '<div class="test">Test</div>',
      '.test { padding: 10px; padding-left: 20px; }'
    );
    const div = findNode(root, "div");

    // Longhand should override shorthand
    expect(div.style.paddingTop).toBeCloseTo(10);
    expect(div.style.paddingRight).toBeCloseTo(10);
    expect(div.style.paddingBottom).toBeCloseTo(10);
    expect(div.style.paddingLeft).toBeCloseTo(20);
  });
});
