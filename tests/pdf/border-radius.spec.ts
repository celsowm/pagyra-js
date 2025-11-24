import { describe, it, expect } from "vitest";
import { renderTreeForHtml } from "../helpers/render-utils.js";

describe("PDF border-radius calculations", () => {
  it("converts border-radius: 15px correctly", async () => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rounded Border Example</title>
  <style>
    .rounded-box {
      display: inline-block;
      padding: 20px 30px;
      border: 2px solid #333;
      border-radius: 15px;
      background-color: #f9f9f9;
      text-align: center;
      font-family: Arial, sans-serif;
    }
  </style>
</head>
<body>
  <div class="rounded-box">
    <span>border-radius: 15px</span>
  </div>
</body>
</html>`;

    const renderTree = await renderTreeForHtml(html);
    const body = renderTree.root.children[0];

    console.log("=== Full Tree Structure ===");
    function logTree(box: any, indent = 0) {
      const pad = '  '.repeat(indent);
      console.log(`${pad}${box.id}: ${box.tagName || 'text'} - borderRadius: ${box.borderRadius?.topLeft?.x || 0}`);
      box.children.forEach((child: any) => logTree(child, indent + 1));
    }
    logTree(body);

    // Find the div with class "rounded-box" - it should have border-radius
    function findBoxWithBorderRadius(box: any): any {
      if (box.borderRadius?.topLeft?.x > 0) return box;
      for (const child of box.children) {
        const found = findBoxWithBorderRadius(child);
        if (found) return found;
      }
      return null;
    }

    const roundedBox = findBoxWithBorderRadius(body);

    if (!roundedBox) {
      console.log("No box with border-radius found!");
      expect.fail("No element with border-radius found");
    }

    console.log("Found rounded box:", roundedBox.id, roundedBox.tagName, roundedBox.borderRadius);

    // Debug size calculations
    console.log("=== Size Calculation Debug ===");
    console.log("Border box:", roundedBox.borderBox);
    console.log("Padding box:", roundedBox.paddingBox);
    console.log("Content box:", roundedBox.contentBox);
    console.log("Padding values:", roundedBox.padding);
    console.log("Border values:", roundedBox.border);

    // Calculate expected dimensions
    const expectedContentWidth = Math.max(0, roundedBox.paddingBox.width - roundedBox.padding.left - roundedBox.padding.right);
    const expectedContentHeight = Math.max(0, roundedBox.paddingBox.height - roundedBox.padding.top - roundedBox.padding.bottom);
    console.log("Expected content width:", expectedContentWidth, "(paddingBox.width - padding.left - padding.right)");
    console.log("Expected content height:", expectedContentHeight, "(paddingBox.height - padding.top - padding.bottom)");

    // Check that border-radius is 15px
    expect(roundedBox.borderRadius.topLeft.x).toBe(15);
    expect(roundedBox.borderRadius.topLeft.y).toBe(15);
    expect(roundedBox.borderRadius.topRight.x).toBe(15);
    expect(roundedBox.borderRadius.topRight.y).toBe(15);
    expect(roundedBox.borderRadius.bottomRight.x).toBe(15);
    expect(roundedBox.borderRadius.bottomRight.y).toBe(15);
    expect(roundedBox.borderRadius.bottomLeft.x).toBe(15);
    expect(roundedBox.borderRadius.bottomLeft.y).toBe(15);
  });
});
