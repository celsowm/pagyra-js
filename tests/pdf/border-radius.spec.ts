import { describe, it, expect } from "vitest";
import { renderTreeForHtml } from "../helpers/render-utils.js";
import * as fs from "fs";

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

function findBoxWithBorderRadius(box: RenderBox): RenderBox | null {
  if (box?.borderRadius && box.borderRadius.topLeft?.x > 0) {
    return box;
  }
  for (const child of box.children ?? []) {
    const found = findBoxWithBorderRadius(child);
    if (found) return found;
  }
  return null;
}

function findChildSpan(box: RenderBox): RenderBox | null {
  for (const child of box.children ?? []) {
    if (child.tagName === "span") return child;
  }
  return null;
}

function logTree(box: RenderBox, indent = 0): void {
  console.log(
    JSON.stringify(
      {
        tag: "render_tree_node",
        indent,
        id: box.id,
        tagName: box.tagName || "text",
        borderRadius: box.borderRadius?.topLeft?.x ?? 0,
        borderBox: box.borderBox,
      },
      null,
      2,
    )
  );
  for (const child of box.children ?? []) {
    logTree(child, indent + 1);
  }
}

function expectApprox(
  actual: number,
  expected: number,
  tolerance: number,
  label: string,
) {
  const diff = actual - expected;
  console.log(
    JSON.stringify(
      {
        tag: "approx_check",
        label,
        expected,
        actual,
        diff,
        tolerance,
      },
      null,
      2,
    ),
  );
  expect(Math.abs(diff)).toBeLessThanOrEqual(tolerance);
}

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

    console.log(JSON.stringify({ tag: "render_tree_start" }, null, 2));
    logTree(body);

    const roundedBox = findBoxWithBorderRadius(body);
    if (!roundedBox) expect.fail("No element with border-radius found");

    const spanBox = findChildSpan(roundedBox);
    if (!spanBox) expect.fail("No <span> box found inside rounded box");

    const parentRect = roundedBox.borderBox;
    const contentRect = roundedBox.contentBox;

    const paddingLeft = roundedBox.padding.left;
    const paddingTop = roundedBox.padding.top;
    const borderLeft = roundedBox.border.left;
    const borderTop = roundedBox.border.top;

    const realX_content = contentRect.x - parentRect.x;
    const realY_content = contentRect.y - parentRect.y;

    const calcX_content = borderLeft + paddingLeft;
    const calcY_content = borderTop + paddingTop;

    const diffX_content = realX_content - calcX_content;
    const diffY_content = realY_content - calcY_content;

    console.log(
      JSON.stringify(
        {
          tag: "content_position",
          parentRect,
          contentRect,
          realX_content,
          calcX_content,
          diffX_content,
          realY_content,
          calcY_content,
          diffY_content,
        },
        null,
        2,
      ),
    );

    expect(Math.abs(diffX_content)).toBeLessThanOrEqual(POSITION_TOL);
    expect(Math.abs(diffY_content)).toBeLessThanOrEqual(POSITION_TOL);

    const spanRect = spanBox.borderBox;

    const realX_span = spanRect.x - parentRect.x;
    const realY_span = spanRect.y - parentRect.y;

    const calcX_span = borderLeft + paddingLeft;
    const calcY_span = borderTop + paddingTop;

    const diffX_span = realX_span - calcX_span;
    const diffY_span = realY_span - calcY_span;

    console.log(
      JSON.stringify(
        {
          tag: "span_position",
          spanRect,
          realX_span,
          calcX_span,
          diffX_span,
          realY_span,
          calcY_span,
          diffY_span,
        },
        null,
        2,
      ),
    );

    expect(Math.abs(diffX_span)).toBeLessThanOrEqual(POSITION_TOL);
    expect(Math.abs(diffY_span)).toBeLessThanOrEqual(POSITION_TOL);

    const paddingRight = roundedBox.padding.right;
    const paddingBottom = roundedBox.padding.bottom;
    const borderRight = roundedBox.border.right;
    const borderBottom = roundedBox.border.bottom;

    const contentWidth = contentRect.width;
    const contentHeight = contentRect.height;

    const realWidth = parentRect.width;
    const realHeight = parentRect.height;

    const calcWidth =
      contentWidth + paddingLeft + paddingRight + borderLeft + borderRight;
    const calcHeight =
      contentHeight + paddingTop + paddingBottom + borderTop + borderBottom;

    const diffWidthInternal = realWidth - calcWidth;
    const diffHeightInternal = realHeight - calcHeight;

    console.log(
      JSON.stringify(
        {
          tag: "box_model_internal",
          contentWidth,
          contentHeight,
          padding: roundedBox.padding,
          border: roundedBox.border,
          realWidth,
          calcWidth,
          diffWidthInternal,
          realHeight,
          calcHeight,
          diffHeightInternal,
        },
        null,
        2,
      ),
    );

    expect(Math.abs(diffWidthInternal)).toBeLessThanOrEqual(SIZE_TOL);
    expect(Math.abs(diffHeightInternal)).toBeLessThanOrEqual(SIZE_TOL);

    const diffContentWidth = contentWidth - BROWSER_REF.contentWidth;
    const diffBorderBoxWidth = realWidth - BROWSER_REF.borderBoxWidth;
    const diffContentHeight = contentHeight - BROWSER_REF.contentHeight;
    const diffBorderBoxHeight = realHeight - BROWSER_REF.borderBoxHeight;

    console.log(
      JSON.stringify(
        {
          tag: "browser_comparison",
          browser: BROWSER_REF,
          pagyra: {
            contentWidth,
            contentHeight,
            borderBoxWidth: realWidth,
            borderBoxHeight: realHeight,
          },
          diffs: {
            diffContentWidth,
            diffBorderBoxWidth,
            diffContentHeight,
            diffBorderBoxHeight,
          },
        },
        null,
        2,
      ),
    );

    expectApprox(
      contentWidth,
      BROWSER_REF.contentWidth,
      BROWSER_REF.toleranceWidth,
      "content width vs browser",
    );
    expectApprox(
      realWidth,
      BROWSER_REF.borderBoxWidth,
      BROWSER_REF.toleranceWidth,
      "border-box width vs browser",
    );
    expectApprox(
      contentHeight,
      BROWSER_REF.contentHeight,
      BROWSER_REF.toleranceHeight,
      "content height vs browser",
    );
    expectApprox(
      realHeight,
      BROWSER_REF.borderBoxHeight,
      BROWSER_REF.toleranceHeight,
      "border-box height vs browser",
    );

    const runs = roundedBox.textRuns ?? [];
    const firstRun = runs[0];
    let fontDiagnostics = "";

    if (firstRun) {
      const fullText = runs.map((r: any) => r.text).join("");
      const totalChars = fullText.length || 1;
      const fontSize = firstRun.fontSize;
      const fontFamily = firstRun.fontFamily;
      const fontFactor = contentWidth / (totalChars * fontSize);

      console.log(
        JSON.stringify(
          {
            tag: "font_factor",
            fullText,
            totalChars,
            fontSize,
            fontFamily,
            fontFactor,
          },
          null,
          2,
        ),
      );

      fontDiagnostics = `
Text:          ${JSON.stringify(fullText)}
totalChars:    ${totalChars}
fontSize:      ${fontSize}
fontFamily:    ${fontFamily}
fontFactor:    ${fontFactor}
`;
    } else {
      fontDiagnostics = "No textRuns available on roundedBox";
    }

    const diagnosticReport = `
=================================================================
PAGYRA vs BROWSER - BORDER-RADIUS, BOX MODEL, SHRINK-TO-FIT & SPAN X/Y
=================================================================

CSS:
  padding: ${CSS.paddingTop}px ${CSS.paddingLeft}px;
  border: ${CSS.borderWidth}px solid;
  border-radius: ${CSS.borderRadius}px;

BROWSER (measured reference):
  contentWidth:     ${BROWSER_REF.contentWidth}px
  contentHeight:    ${BROWSER_REF.contentHeight}px
  borderBoxWidth:   ${BROWSER_REF.borderBoxWidth}px
  borderBoxHeight:  ${BROWSER_REF.borderBoxHeight}px

PAGYRA:
  contentWidth:     ${contentWidth.toFixed(2)}px
  contentHeight:    ${contentHeight.toFixed(2)}px
  borderBoxWidth:   ${realWidth.toFixed(2)}px
  borderBoxHeight:  ${realHeight.toFixed(2)}px

Differences (Pagyra - Browser):
  contentWidth:     ${diffContentWidth.toFixed(2)}px
  borderBoxWidth:   ${diffBorderBoxWidth.toFixed(2)}px
  contentHeight:    ${diffContentHeight.toFixed(2)}px
  borderBoxHeight:  ${diffBorderBoxHeight.toFixed(2)}px

-----------------------------------------------------------------
CONTENT POSITION
-----------------------------------------------------------------
parentRect:  ${JSON.stringify(parentRect, null, 2)}
contentRect: ${JSON.stringify(contentRect, null, 2)}

-----------------------------------------------------------------
SPAN POSITION
-----------------------------------------------------------------
spanRect: ${JSON.stringify(spanRect, null, 2)}

-----------------------------------------------------------------
FONT DIAGNOSTICS
-----------------------------------------------------------------
${fontDiagnostics}

=================================================================
`;

    fs.writeFileSync(
      "border-radius-browser-vs-pdf-diagnostic.txt",
      diagnosticReport,
      "utf-8",
    );

    console.log(
      JSON.stringify(
        {
          tag: "diagnostic_file_written",
          file: "border-radius-browser-vs-pdf-diagnostic.txt",
        },
        null,
        2,
      ),
    );
  });
});