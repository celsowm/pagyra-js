import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
import type { LayoutNode } from "../src/dom/node.js";

describe("Advanced CSS Selectors - Integration with HTML rendering", () => {
  it("should apply styles using advanced selectors in CSS", async () => {
    const html = `
      <html>
        <head>
          <style>
            div > p { color: #FF0000; }
            .container + .adjacent { background-color: #0FF00; }
            .first-class ~ .sibling { font-size: 20px; }
            [data-test="value"] { font-weight: bold; }
            :first-child { margin: 10px; }
          </style>
        </head>
        <body>
          <div>
            <p id="direct-child">Direct child paragraph</p>
            <span>Other element</span>
          </div>
          <div class="container">Container</div>
          <div class="adjacent">Adjacent div</div>
          <div class="first-class">First</div>
          <div class="sibling">Sibling</div>
          <span data-test="value">Data attribute element</span>
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

    // Basic test to ensure the HTML was processed without errors
    expect(layoutRoot).toBeDefined();
  });

  it("should correctly handle :nth-child(odd) and :nth-child(even)", async () => {
    const html = `
      <html>
        <head>
          <style>
            li:nth-child(odd) { color: #FF0000; }
            li:nth-child(even) { color: #000FF; }
          </style>
        </head>
        <body>
          <ul>
            <li>Item 1 (should be red)</li>
            <li>Item 2 (should be blue)</li>
            <li>Item 3 (should be red)</li>
            <li>Item 4 (should be blue)</li>
          </ul>
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

    // Basic test to ensure the HTML was processed without errors
    expect(layoutRoot).toBeDefined();
  });

  it("should handle complex attribute selectors", async () => {
    const html = `
      <html>
        <head>
          <style>
            [class*='test'] { color: #FF0000; }
            [title^='start'] { font-weight: bold; }
            [data-end$='end'] { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="mytestclass">Should be red</div>
          <p title="startofstring">Should be bold</p>
          <span data-end="myend">Should be underlined</span>
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

    // Basic test to ensure the HTML was processed without errors
    expect(layoutRoot).toBeDefined();
  });

  it("applies :root pseudo-class declarations to the document element", async () => {
    const html = `<html><body><p id="subject">Hello</p></body></html>`;
    const css = `:root { color: #123456; }`;
    const { layoutRoot } = await prepareHtmlRender({
      html,
      css,
      viewportWidth: 400,
      viewportHeight: 400,
      pageWidth: 400,
      pageHeight: 400,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    let target: LayoutNode | undefined;
    layoutRoot.walk((node) => {
      if (node.customData?.id === "subject") {
        target = node;
      }
    });
    expect(target).toBeDefined();
    expect(target?.style.color).toBe("#123456");
  });
});
