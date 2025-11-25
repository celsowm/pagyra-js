import { describe, it } from "vitest";
import { renderTreeForHtml } from "../helpers/render-utils.js";
import {
  findBoxWithBorderRadius,
  findChildSpan,
  createDiagnosticsContext,
  addNumericCheck,
  renderAsciiLayout,
  finalizeDiagnostics,
} from "../helpers/ai-layout-diagnostics.js";

type RenderBox = any;

// --- Single source of truth for the CSS used in the HTML ---
const CSS = {
  paddingTop: 20,
  paddingBottom: 20,
  paddingLeft: 30,
  paddingRight: 30,
  borderWidth: 2,
  borderRadius: 15,
};

// --- Reference values measured in the BROWSER (via HTML+JS) ---
const BROWSER_REF = {
  contentWidth: 139,
  contentHeight: 19,
  borderBoxWidth: 203,
  borderBoxHeight: 63,
  toleranceWidth: 2,
  toleranceHeight: 2,
};

const POSITION_TOL = 1;
const SIZE_TOL = 0.5;

describe("Rounded box PDF vs Browser (border-radius + shrink-to-fit + text position)", () => {
  it("keeps border-radius and approximates browser layout, including span X/Y", async () => {
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
      padding: ${CSS.paddingTop}px ${CSS.paddingLeft}px;
      border: ${CSS.borderWidth}px solid #333;
      border-radius: ${CSS.borderRadius}px;
      background-color: #f9f9f9;
      text-align: center;
      font-family: Arial, sans-serif;
      font-size: 16px;
      line-height: 1.2;
    }
  </style>
</head>
<body>
  <div class="rounded-box">
    <span>border-radius: 15px</span>
  </div>
</body>
</html>`.trim();

    const renderTree = await renderTreeForHtml(html);
    const root: RenderBox = renderTree.root;
    const body: RenderBox = root.children[0];

    const roundedBox = findBoxWithBorderRadius(body);
    if (!roundedBox) throw new Error("No element with border-radius found");

    const spanBox = findChildSpan(roundedBox);
    if (!spanBox) throw new Error("No <span> box found inside rounded box");

    const parentRect = roundedBox.borderBox;
    const contentRect = roundedBox.contentBox;
    const spanRect = spanBox.borderBox;
    const padding = roundedBox.padding;
    const border = roundedBox.border;

    const paddingLeft = padding.left;
    const paddingTop = padding.top;
    const borderLeft = border.left;
    const borderTop = border.top;

    const realX_content = contentRect.x - parentRect.x;
    const realY_content = contentRect.y - parentRect.y;
    const calcX_content = borderLeft + paddingLeft;
    const calcY_content = borderTop + paddingTop;
    const diffX_content = realX_content - calcX_content;
    const diffY_content = realY_content - calcY_content;

    const realX_span = spanRect.x - parentRect.x;
    const realY_span = spanRect.y - parentRect.y;
    const calcX_span = borderLeft + paddingLeft;
    const calcY_span = borderTop + paddingTop;
    const diffX_span = realX_span - calcX_span;
    const diffY_span = realY_span - calcY_span;

    const paddingRight = padding.right;
    const paddingBottom = padding.bottom;
    const borderRight = border.right;
    const borderBottom = border.bottom;

    const contentWidth = contentRect.width;
    const contentHeight = contentRect.height;
    const realWidth = parentRect.width;
    const realHeight = parentRect.height;
    const calcWidth = contentWidth + paddingLeft + paddingRight + borderLeft + borderRight;
    const calcHeight = contentHeight + paddingTop + paddingBottom + borderTop + borderBottom;
    const diffWidthInternal = realWidth - calcWidth;
    const diffHeightInternal = realHeight - calcHeight;

    const runs = roundedBox.textRuns ?? [];
    const firstRun = runs[0];
    let fontDiagnostics = "";

    if (firstRun) {
      const fullText = runs.map((r: any) => r.text).join("");
      const totalChars = fullText.length || 1;
      const fontSize = firstRun.fontSize;
      const fontFamily = firstRun.fontFamily;
      const fontFactor = contentWidth / (totalChars * fontSize);
      fontDiagnostics = `
Text: ${JSON.stringify(fullText)}
totalChars: ${totalChars}
fontSize: ${fontSize}
fontFamily: ${fontFamily}
fontFactor: ${fontFactor}
`;
    } else {
      fontDiagnostics = "No textRuns available on roundedBox";
    }

    createDiagnosticsContext(
      "border-radius-shrink-to-fit-pdf-vs-browser",
      CSS,
      BROWSER_REF,
      parentRect,
      contentRect,
      spanRect,
      padding,
      border,
      fontDiagnostics
    );

    addNumericCheck(diffX_content, 0, POSITION_TOL, "content x position");
    addNumericCheck(diffY_content, 0, POSITION_TOL, "content y position");
    addNumericCheck(diffX_span, 0, POSITION_TOL, "span x position");
    addNumericCheck(diffY_span, 0, POSITION_TOL, "span y position");
    addNumericCheck(diffWidthInternal, 0, SIZE_TOL, "internal box model width");
    addNumericCheck(diffHeightInternal, 0, SIZE_TOL, "internal box model height");
    addNumericCheck(contentWidth, BROWSER_REF.contentWidth, BROWSER_REF.toleranceWidth, "content width vs browser");
    addNumericCheck(realWidth, BROWSER_REF.borderBoxWidth, BROWSER_REF.toleranceWidth, "border-box width vs browser");
    addNumericCheck(contentHeight, BROWSER_REF.contentHeight, BROWSER_REF.toleranceHeight, "content height vs browser");
    addNumericCheck(realHeight, BROWSER_REF.borderBoxHeight, BROWSER_REF.toleranceHeight, "border-box height vs browser");

    renderAsciiLayout();
    finalizeDiagnostics();
  });
});
