import { describe, it, expect } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import { LayoutNode } from "../src/dom/node.js";

describe("DOM ID Preservation", () => {
  it("should preserve HTML element IDs in the layout tree", async () => {
    const html = `
      <html>
        <body>
          <div id="test-div">Test Div</div>
          <p id="test-paragraph">Test Paragraph</p>
          <span id="test-span">Test Span</span>
          <div id="nested-parent">
            <div id="nested-child">Nested Child</div>
          </div>
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

    // Helper function to find a node by ID in the layout tree
    function findNodeById(node: LayoutNode, id: string): LayoutNode | null {
      if (node.customData?.id === id) {
        return node;
      }

      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) {
          return found;
        }
      }

      return null;
    }

    // Test that all IDs are preserved
    const testDiv = findNodeById(layoutRoot, "test-div");
    expect(testDiv).toBeDefined();
    expect(testDiv?.customData?.id).toBe("test-div");

    const testParagraph = findNodeById(layoutRoot, "test-paragraph");
    expect(testParagraph).toBeDefined();
    expect(testParagraph?.customData?.id).toBe("test-paragraph");

    const testSpan = findNodeById(layoutRoot, "test-span");
    expect(testSpan).toBeDefined();
    expect(testSpan?.customData?.id).toBe("test-span");

    const nestedParent = findNodeById(layoutRoot, "nested-parent");
    expect(nestedParent).toBeDefined();
    expect(nestedParent?.customData?.id).toBe("nested-parent");

    const nestedChild = findNodeById(layoutRoot, "nested-child");
    expect(nestedChild).toBeDefined();
    expect(nestedChild?.customData?.id).toBe("nested-child");
  });

  it("should preserve IDs in nested structures", async () => {
    const html = `
      <html>
        <body>
          <div id="container">
            <div id="header">
              <h1 id="title">Title</h1>
            </div>
            <div id="content">
              <p id="paragraph-1">First paragraph</p>
              <p id="paragraph-2">Second paragraph</p>
            </div>
            <div id="footer">
              <span id="copyright">Copyright</span>
            </div>
          </div>
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

    // Helper function to find a node by ID in the layout tree
    function findNodeById(node: LayoutNode, id: string): LayoutNode | null {
      if (node.customData?.id === id) {
        return node;
      }

      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) {
          return found;
        }
      }

      return null;
    }

    // Test that all IDs are preserved in the nested structure
    const container = findNodeById(layoutRoot, "container");
    expect(container).toBeDefined();
    expect(container?.customData?.id).toBe("container");

    const header = findNodeById(layoutRoot, "header");
    expect(header).toBeDefined();
    expect(header?.customData?.id).toBe("header");

    const title = findNodeById(layoutRoot, "title");
    expect(title).toBeDefined();
    expect(title?.customData?.id).toBe("title");

    const content = findNodeById(layoutRoot, "content");
    expect(content).toBeDefined();
    expect(content?.customData?.id).toBe("content");

    const paragraph1 = findNodeById(layoutRoot, "paragraph-1");
    expect(paragraph1).toBeDefined();
    expect(paragraph1?.customData?.id).toBe("paragraph-1");

    const paragraph2 = findNodeById(layoutRoot, "paragraph-2");
    expect(paragraph2).toBeDefined();
    expect(paragraph2?.customData?.id).toBe("paragraph-2");

    const footer = findNodeById(layoutRoot, "footer");
    expect(footer).toBeDefined();
    expect(footer?.customData?.id).toBe("footer");

    const copyright = findNodeById(layoutRoot, "copyright");
    expect(copyright).toBeDefined();
    expect(copyright?.customData?.id).toBe("copyright");
  });

  it("should handle elements without IDs", async () => {
    const html = `
      <html>
        <body>
          <div>No ID</div>
          <p>No ID paragraph</p>
          <div id="with-id">With ID</div>
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

    // Helper function to find a node by ID in the layout tree
    function findNodeById(node: LayoutNode, id: string): LayoutNode | null {
      if (node.customData?.id === id) {
        return node;
      }

      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) {
          return found;
        }
      }

      return null;
    }

    // Test that the element with ID is preserved
    const withId = findNodeById(layoutRoot, "with-id");
    expect(withId).toBeDefined();
    expect(withId?.customData?.id).toBe("with-id");

    // The test passes if no errors occur with elements without IDs
  });
});
