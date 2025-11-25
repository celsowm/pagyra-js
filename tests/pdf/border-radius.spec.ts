import { describe, it, expect } from "vitest";
import { renderTreeForHtml } from "../helpers/render-utils.js";
import * as fs from "fs";

type RenderBox = any;

// --- Única fonte de verdade do CSS usado no HTML ---
const CSS = {
  paddingTop: 20,
  paddingBottom: 20,
  paddingLeft: 30,
  paddingRight: 30,
  borderWidth: 2,
  borderRadius: 15,
};

// --- Valores de referência medidos no BROWSER (via HTML+JS) ---
const BROWSER_REF = {
  contentWidth: 139,     // área de conteúdo
  contentHeight: 19,     // altura da área de conteúdo
  borderBoxWidth: 203,   // 139 + 60 + 4
  borderBoxHeight: 63,   // 19 + 40 + 4
  toleranceWidth: 2,     // px
  toleranceHeight: 2,    // px
};

// tolerâncias internas (subpixel / font-rendering)
const POSITION_TOL = 1;  // px para X/Y (igual seu medirBox)
const SIZE_TOL = 0.5;    // px para consistência do box-model

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
  // normalmente é o primeiro filho da .rounded-box
  for (const child of box.children ?? []) {
    if (child.tagName === "span") return child;
  }
  return null;
}

function logTree(box: RenderBox, indent = 0): void {
  const pad = "  ".repeat(indent);
  console.log(
    `${pad}${box.id}: ${box.tagName || "text"} - borderRadius: ${box.borderRadius?.topLeft?.x ?? 0
    } - borderBox: ${JSON.stringify(box.borderBox)}`
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
    `[${label}] expected≈${expected.toFixed(2)}px, actual=${actual.toFixed(
      2,
    )}px, diff=${diff.toFixed(2)}px`,
  );
  expect(Math.abs(diff)).toBeLessThanOrEqual(tolerance);
}

describe("Rounded box PDF vs Browser (border-radius + shrink-to-fit + text position)", () => {
  it("mantém border-radius e aproxima o layout do browser, incluindo X/Y do span", async () => {
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

    console.log("=== Render tree ===");
    logTree(body);

    const roundedBox = findBoxWithBorderRadius(body);
    if (!roundedBox) {
      expect.fail("No element with border-radius found");
    }

    const spanBox = findChildSpan(roundedBox);
    if (!spanBox) {
      expect.fail("No <span> box found inside rounded box");
    }

    // -------------------------------------------------------------------
    // 1. CSS aplicado corretamente (padding/border/radius) – DRY
    // -------------------------------------------------------------------
    const expectedPadding: Record<"top" | "right" | "bottom" | "left", number> = {
      top: CSS.paddingTop,
      bottom: CSS.paddingBottom,
      left: CSS.paddingLeft,
      right: CSS.paddingRight,
    };

    (["top", "right", "bottom", "left"] as const).forEach((side) => {
      expect(roundedBox.padding[side]).toBe(expectedPadding[side]);
      expect(roundedBox.border[side]).toBe(CSS.borderWidth);
    });

    const corners = roundedBox.borderRadius as Record<
      string,
      { x: number; y: number }
    >;

    Object.values(corners).forEach(corner => {
      expect(corner.x).toBe(CSS.borderRadius);
      expect(corner.y).toBe(CSS.borderRadius);
    });

    // -------------------------------------------------------------------
    // 2. POSIÇÃO DO CONTEÚDO (tipo medirBox, usando contentBox)
    // -------------------------------------------------------------------
    const parentRect = roundedBox.borderBox;   // container (.rounded-box)
    const contentRect = roundedBox.contentBox; // área de conteúdo da div

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

    console.log("\n=== POSIÇÃO contentBox (tipo medirBox) ===");
    console.log({
      parentRect,
      contentRect,
      realX_content,
      calcX_content,
      diffX_content,
      realY_content,
      calcY_content,
      diffY_content,
    });

    expect(Math.abs(diffX_content)).toBeLessThanOrEqual(POSITION_TOL);
    expect(Math.abs(diffY_content)).toBeLessThanOrEqual(POSITION_TOL);

    // -------------------------------------------------------------------
    // 3. POSIÇÃO DO <span> (X/Y do span, equivalente ao "nó texto")
    // -------------------------------------------------------------------
    const spanRect = spanBox.borderBox; // bounding box do span (inline)

    const realX_span = spanRect.x - parentRect.x;
    const realY_span = spanRect.y - parentRect.y;

    // como é shrink-to-fit, o conteúdo ocupa a largura toda; text-align:center
    // não gera sobra, então o span começa no mesmo ponto do contentBox
    const calcX_span = borderLeft + paddingLeft;
    const calcY_span = borderTop + paddingTop;

    const diffX_span = realX_span - calcX_span;
    const diffY_span = realY_span - calcY_span;

    console.log("\n=== POSIÇÃO <span> (X/Y) ===");
    console.log({
      spanRect,
      realX_span,
      calcX_span,
      diffX_span,
      realY_span,
      calcY_span,
      diffY_span,
    });

    expect(Math.abs(diffX_span)).toBeLessThanOrEqual(POSITION_TOL);
    expect(Math.abs(diffY_span)).toBeLessThanOrEqual(POSITION_TOL);

    // -------------------------------------------------------------------
    // 4. BOX MODEL INTERNO (content+padding+border = borderBox)
    // -------------------------------------------------------------------
    const paddingRight = roundedBox.padding.right;
    const paddingBottom = roundedBox.padding.bottom;
    const borderRight = roundedBox.border.right;
    const borderBottom = roundedBox.border.bottom;

    const contentWidth = contentRect.width;
    const contentHeight = contentRect.height;

    const realWidth = parentRect.width;   // border-box width
    const realHeight = parentRect.height; // border-box height

    const calcWidth =
      contentWidth + paddingLeft + paddingRight + borderLeft + borderRight;
    const calcHeight =
      contentHeight + paddingTop + paddingBottom + borderTop + borderBottom;

    const diffWidthInternal = realWidth - calcWidth;
    const diffHeightInternal = realHeight - calcHeight;

    console.log("\n=== BOX MODEL (interno) ===");
    console.log({
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
    });

    expect(Math.abs(diffWidthInternal)).toBeLessThanOrEqual(SIZE_TOL);
    expect(Math.abs(diffHeightInternal)).toBeLessThanOrEqual(SIZE_TOL);

    // -------------------------------------------------------------------
    // 5. COMPARAÇÃO DIRETA COM O BROWSER (onde aparece o bug da imagem)
    // -------------------------------------------------------------------
    const diffContentWidth = contentWidth - BROWSER_REF.contentWidth;
    const diffBorderBoxWidth = realWidth - BROWSER_REF.borderBoxWidth;
    const diffContentHeight = contentHeight - BROWSER_REF.contentHeight;
    const diffBorderBoxHeight = realHeight - BROWSER_REF.borderBoxHeight;

    console.log("\n=== PAGYRA vs BROWSER (dimensões) ===");
    console.log({
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
    });

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

    // -------------------------------------------------------------------
    // 6. FATOR FONTE (sanity check, ainda dinâmico)
    // -------------------------------------------------------------------
    const runs = roundedBox.textRuns ?? [];
    const firstRun = runs[0];
    let fontDiagnostics = "";

    if (firstRun) {
      const fullText = runs.map((r: any) => r.text).join("");
      const totalChars = fullText.length || 1;
      const fontSize = firstRun.fontSize;
      const fontFamily = firstRun.fontFamily;
      const fontFactor = contentWidth / (totalChars * fontSize);

      console.log("\n=== FATOR FONTE ===");
      console.log({ fullText, totalChars, fontSize, fontFamily, fontFactor });

      expect(fontSize).toBeGreaterThan(0);
      expect(totalChars).toBeGreaterThan(0);
      expect(fontFactor).toBeGreaterThan(0);
      expect(fontFactor).toBeLessThan(5);
      expect(String(fontFamily).toLowerCase()).toContain("arial");

      fontDiagnostics = `
Texto:         ${JSON.stringify(fullText)}
totalChars:    ${totalChars}
fontSize:      ${fontSize}
fontFamily:    ${fontFamily}
fontFactor:    ${fontFactor}
`;
    } else {
      fontDiagnostics = "No textRuns available on roundedBox";
    }

    // -------------------------------------------------------------------
    // 7. Relatório de diagnóstico em arquivo
    // -------------------------------------------------------------------
    const diagnosticReport = `
=================================================================
PAGYRA vs BROWSER - BORDER-RADIUS, BOX MODEL, SHRINK-TO-FIT & SPAN X/Y
=================================================================

CSS:
  padding: ${CSS.paddingTop}px ${CSS.paddingLeft}px;
  border: ${CSS.borderWidth}px solid;
  border-radius: ${CSS.borderRadius}px;

BROWSER (referência medida):
  contentWidth:     ${BROWSER_REF.contentWidth}px
  contentHeight:    ${BROWSER_REF.contentHeight}px
  borderBoxWidth:   ${BROWSER_REF.borderBoxWidth}px
  borderBoxHeight:  ${BROWSER_REF.borderBoxHeight}px

PAGYRA:
  contentWidth:     ${contentWidth.toFixed(2)}px
  contentHeight:    ${contentHeight.toFixed(2)}px
  borderBoxWidth:   ${realWidth.toFixed(2)}px
  borderBoxHeight:  ${realHeight.toFixed(2)}px

Diferenças (Pagyra - Browser):
  contentWidth:     ${diffContentWidth.toFixed(2)}px
  borderBoxWidth:   ${diffBorderBoxWidth.toFixed(2)}px
  contentHeight:    ${diffContentHeight.toFixed(2)}px
  borderBoxHeight:  ${diffBorderBoxHeight.toFixed(2)}px

-----------------------------------------------------------------
POSIÇÃO contentBox (.rounded-box)
-----------------------------------------------------------------
parentRect (borderBox):  ${JSON.stringify(parentRect, null, 2)}
contentRect (contentBox):${JSON.stringify(contentRect, null, 2)}

realX(content) = ${realX_content.toFixed(4)}px
calcX(content) = ${calcX_content.toFixed(4)}px
diffX(content) = ${diffX_content.toFixed(4)}px

realY(content) = ${realY_content.toFixed(4)}px
calcY(content) = ${calcY_content.toFixed(4)}px
diffY(content) = ${diffY_content.toFixed(4)}px

-----------------------------------------------------------------
POSIÇÃO <span> (equivalente ao "nó texto")
-----------------------------------------------------------------
spanRect (borderBox): ${JSON.stringify(spanRect, null, 2)}

realX(span) = ${realX_span.toFixed(4)}px
calcX(span) = ${calcX_span.toFixed(4)}px
diffX(span) = ${diffX_span.toFixed(4)}px

realY(span) = ${realY_span.toFixed(4)}px
calcY(span) = ${calcY_span.toFixed(4)}px
diffY(span) = ${diffY_span.toFixed(4)}px

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
      "\n📝 Diagnostic report written to: border-radius-browser-vs-pdf-diagnostic.txt",
    );
  });
});
