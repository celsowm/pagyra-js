import { expect, test } from "vitest";
import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import type { RenderBox } from "../../src/pdf/types.js";

function collectBoxesById(box: RenderBox, ids: Set<string>, acc: RenderBox[] = []): RenderBox[] {
  if (box.customData && typeof box.customData.id === "string" && ids.has(box.customData.id)) {
    acc.push(box);
  }
  for (const child of box.children) {
    collectBoxesById(child, ids, acc);
  }
  return acc;
}

test("background-origin controls which box rect is used for background positioning", async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          .box {
            width: 120px;
            height: 120px;
            border: 10px solid black;
            padding: 10px;
            background-image: linear-gradient(45deg, red, blue);
            background-size: 20px 20px;
            background-repeat: no-repeat;
            background-position: left top;
          }
          #border-origin {
            background-origin: border-box;
          }
          #padding-origin {
            background-origin: padding-box;
          }
          #content-origin {
            background-origin: content-box;
          }
        </style>
      </head>
      <body>
        <div id="border-origin" class="box"></div>
        <div id="padding-origin" class="box"></div>
        <div id="content-origin" class="box"></div>
      </body>
    </html>
  `;

  const prepared = await prepareHtmlRender({
    html,
    css: "",
    viewportWidth: 400,
    viewportHeight: 800,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const ids = new Set(["border-origin", "padding-origin", "content-origin"]);
  const boxes = collectBoxesById(prepared.renderTree.root, ids);
  expect(boxes.length).toBe(3);

  const borderBox = boxes.find((b) => b.customData?.id === "border-origin")!;
  const paddingBox = boxes.find((b) => b.customData?.id === "padding-origin")!;
  const contentBox = boxes.find((b) => b.customData?.id === "content-origin")!;

  expect(borderBox.background.gradient?.originRect).toEqual(borderBox.borderBox);
  expect(paddingBox.background.gradient?.originRect).toEqual(paddingBox.paddingBox);
  expect(contentBox.background.gradient?.originRect).toEqual(contentBox.contentBox);

  // All gradients use the top-left of their origin rect for positioning
  expect(borderBox.background.gradient?.rect.x).toBe(borderBox.background.gradient?.originRect.x);
  expect(borderBox.background.gradient?.rect.y).toBe(borderBox.background.gradient?.originRect.y);
  expect(paddingBox.background.gradient?.rect.x).toBe(paddingBox.background.gradient?.originRect.x);
  expect(paddingBox.background.gradient?.rect.y).toBe(paddingBox.background.gradient?.originRect.y);
  expect(contentBox.background.gradient?.rect.x).toBe(contentBox.background.gradient?.originRect.x);
  expect(contentBox.background.gradient?.rect.y).toBe(contentBox.background.gradient?.originRect.y);
});

test("background-origin example with flex inner content uses padding-box origin and correct 100% height", async () => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Background Origin - Minimal Example</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
        }

        .bg-origin-box {
          width: 260px;
          height: 160px;
          border: 12px solid #333;
          padding: 16px;
          margin: 20px 0;
          color: #111;
          font-weight: bold;
          box-sizing: content-box;
          background-image: linear-gradient(45deg, #2196f3, #03a9f4);
          background-repeat: no-repeat;
          background-size: 40px 40px;
          background-position: left top;
          background-origin: padding-box;
        }

        .inner-content {
          width: 100%;
          height: 100%;
          border: 1px dashed rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <h1>Exemplo de background-origin</h1>
      <div id="padding-origin-demo" class="bg-origin-box">
        <div id="inner-content-demo" class="inner-content">background-origin: padding-box</div>
      </div>
    </body>
    </html>
  `;

  const prepared = await prepareHtmlRender({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595,
    pageHeight: 842,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  const ids = new Set(["padding-origin-demo", "inner-content-demo"]);
  const boxes = collectBoxesById(prepared.renderTree.root, ids);
  expect(boxes.length).toBe(2);

  const outer = boxes.find((b) => b.customData?.id === "padding-origin-demo")!;
  const inner = boxes.find((b) => b.customData?.id === "inner-content-demo")!;

  const gradient = outer.background.gradient;
  expect(gradient).toBeDefined();
  expect(gradient?.originRect).toEqual(outer.paddingBox);
  expect(gradient?.rect.width).toBeCloseTo(40, 4);
  expect(gradient?.rect.height).toBeCloseTo(40, 4);
  expect(gradient?.rect.x).toBeCloseTo(outer.paddingBox.x, 4);
  expect(gradient?.rect.y).toBeCloseTo(outer.paddingBox.y, 4);

  // The inner flex box with height: 100% should match the outer content box height,
  // ensuring flex alignment is computed against a definite containing block.
  expect(inner.contentBox.height).toBeCloseTo(outer.contentBox.height, 4);
});
