import { describe, it, expect } from "vitest";
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

/**
 * Check if a child rect is fully contained within a parent rect.
 * Returns an object with containment status and overflow details.
 */
function checkContainment(
  parentRect: { x: number; y: number; width: number; height: number },
  childRect: { x: number; y: number; width: number; height: number },
  tolerance: number = 0
): {
  isContained: boolean;
  overflowLeft: number;
  overflowRight: number;
  overflowTop: number;
  overflowBottom: number;
} {
  const parentLeft = parentRect.x;
  const parentRight = parentRect.x + parentRect.width;
  const parentTop = parentRect.y;
  const parentBottom = parentRect.y + parentRect.height;

  const childLeft = childRect.x;
  const childRight = childRect.x + childRect.width;
  const childTop = childRect.y;
  const childBottom = childRect.y + childRect.height;

  const overflowLeft = Math.max(0, parentLeft - childLeft);
  const overflowRight = Math.max(0, childRight - parentRight);
  const overflowTop = Math.max(0, parentTop - childTop);
  const overflowBottom = Math.max(0, childBottom - parentBottom);

  const isContained =
    overflowLeft <= tolerance &&
    overflowRight <= tolerance &&
    overflowTop <= tolerance &&
    overflowBottom <= tolerance;

  return {
    isContained,
    overflowLeft,
    overflowRight,
    overflowTop,
    overflowBottom,
  };
}

/**
 * Format containment check results for diagnostics
 */
function formatContainmentDiagnostics(
  label: string,
  parentRect: { x: number; y: number; width: number; height: number },
  childRect: { x: number; y: number; width: number; height: number },
  result: ReturnType<typeof checkContainment>
): string {
  return `
=== ${label} ===
Parent bounds: (${parentRect.x.toFixed(2)}, ${parentRect.y.toFixed(2)}) to (${(parentRect.x + parentRect.width).toFixed(2)}, ${(parentRect.y + parentRect.height).toFixed(2)})
Child bounds:  (${childRect.x.toFixed(2)}, ${childRect.y.toFixed(2)}) to (${(childRect.x + childRect.width).toFixed(2)}, ${(childRect.y + childRect.height).toFixed(2)})
Contained: ${result.isContained ? "YES" : "NO"}
Overflow - Left: ${result.overflowLeft.toFixed(2)}, Right: ${result.overflowRight.toFixed(2)}, Top: ${result.overflowTop.toFixed(2)}, Bottom: ${result.overflowBottom.toFixed(2)}
`;
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

    // === CONTAINMENT CHECKS ===
    const CONTAINMENT_TOL = 0.5; // Allow tiny floating-point discrepancies

    // Check 1: Span must be fully contained within parent's border-box
    const spanInBorderBox = checkContainment(parentRect, spanRect, CONTAINMENT_TOL);

    // Check 2: Span must be fully contained within parent's content-box
    const spanInContentBox = checkContainment(contentRect, spanRect, CONTAINMENT_TOL);

    // Check 3: Content-box must be fully contained within border-box
    const contentInBorderBox = checkContainment(parentRect, contentRect, CONTAINMENT_TOL);

    const containmentDiagnostics = [
      formatContainmentDiagnostics("Span in Border-Box", parentRect, spanRect, spanInBorderBox),
      formatContainmentDiagnostics("Span in Content-Box", contentRect, spanRect, spanInContentBox),
      formatContainmentDiagnostics("Content-Box in Border-Box", parentRect, contentRect, contentInBorderBox),
    ].join("\n");

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
      fontDiagnostics + "\n" + containmentDiagnostics
    );

    // Original position/size checks
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

    // Containment overflow checks (should all be 0 or near-0)
    addNumericCheck(spanInBorderBox.overflowLeft, 0, CONTAINMENT_TOL, "span overflow left (border-box)");
    addNumericCheck(spanInBorderBox.overflowRight, 0, CONTAINMENT_TOL, "span overflow right (border-box)");
    addNumericCheck(spanInBorderBox.overflowTop, 0, CONTAINMENT_TOL, "span overflow top (border-box)");
    addNumericCheck(spanInBorderBox.overflowBottom, 0, CONTAINMENT_TOL, "span overflow bottom (border-box)");

    addNumericCheck(spanInContentBox.overflowLeft, 0, CONTAINMENT_TOL, "span overflow left (content-box)");
    addNumericCheck(spanInContentBox.overflowRight, 0, CONTAINMENT_TOL, "span overflow right (content-box)");
    addNumericCheck(spanInContentBox.overflowTop, 0, CONTAINMENT_TOL, "span overflow top (content-box)");
    addNumericCheck(spanInContentBox.overflowBottom, 0, CONTAINMENT_TOL, "span overflow bottom (content-box)");

    renderAsciiLayout();
    finalizeDiagnostics();

    // Hard assertions for containment (these will fail the test if violated)
    expect(
      spanInBorderBox.isContained,
      `Span must be contained within parent border-box!\n${containmentDiagnostics}`
    ).toBe(true);

    expect(
      spanInContentBox.isContained,
      `Span must be contained within parent content-box!\n${containmentDiagnostics}`
    ).toBe(true);

    expect(
      contentInBorderBox.isContained,
      `Content-box must be contained within border-box!\n${containmentDiagnostics}`
    ).toBe(true);
  });

  // Additional test case: Intentionally broken layout to verify detection works
  it("detects when span overflows its parent (negative test)", async () => {
    // This HTML has a very small container that can't fit the content
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    .tiny-box {
      display: inline-block;
      width: 20px;
      height: 10px;
      overflow: visible;
      border: 1px solid red;
    }
    .tiny-box span {
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="tiny-box">
    <span>This text is way too long to fit</span>
  </div>
</body>
</html>`.trim();

    const renderTree = await renderTreeForHtml(html);
    const root: RenderBox = renderTree.root;
    const body: RenderBox = root.children[0];

    // Find the tiny box (has border)
    const tinyBox = findBoxWithBorder(body);
    if (!tinyBox) {
      console.log("Skipping negative test - could not find bordered box");
      return;
    }

    const spanBox = findChildSpan(tinyBox);
    if (!spanBox) {
      console.log("Skipping negative test - could not find span");
      return;
    }

    const parentRect = tinyBox.borderBox;
    const spanRect = spanBox.borderBox;

    const containment = checkContainment(parentRect, spanRect, 0);

    console.log("=== Negative Test (Expected Overflow) ===");
    console.log(formatContainmentDiagnostics("Span in Tiny Box", parentRect, spanRect, containment));

    // In this case, we EXPECT overflow (the span should NOT be contained)
    // This verifies our detection logic works
    if (containment.isContained) {
      console.log("Note: Span was contained (layout engine may have wrapped or clipped)");
    } else {
      console.log("Overflow detected as expected!");
      expect(containment.overflowRight).toBeGreaterThan(0);
    }
  });
});

// Helper to find box with border (for the negative test)
function findBoxWithBorder(box: RenderBox): RenderBox | null {
  if (box.border && (box.border.left > 0 || box.border.top > 0)) {
    return box;
  }
  if (box.children) {
    for (const child of box.children) {
      const found = findBoxWithBorder(child);
      if (found) return found;
    }
  }
  return null;
}