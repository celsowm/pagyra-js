import { describe, it, expect, beforeEach, vi } from "vitest";
import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import { PagePainter } from "../../src/pdf/page-painter.js";
import { renderSvgBox } from "../../src/pdf/svg/render-svg.js";

// Mock FontRegistry (same shape used in other tests)
const createMockFontRegistry = () => {
  return {
    ensureFontResource: vi.fn().mockResolvedValue({ baseFont: "Helvetica", resourceName: "F1", ref: { objectNumber: 1 }, isBase14: true }),
    ensureFontResourceSync: vi.fn().mockReturnValue({ baseFont: "Helvetica", resourceName: "F1", ref: { objectNumber: 1 }, isBase14: true }),
    initializeEmbedder: vi.fn().mockResolvedValue(undefined),
    setFontConfig: vi.fn(),
    getEmbedder: vi.fn().mockReturnValue(null),
    getDefaultFontStack: vi.fn().mockReturnValue([]),
  } as any;
};

describe("SVG defs rendering (integration)", () => {
  const pxToPt = (px: number) => px * 0.75;
  const pageHeightPt = 841.89;
  let fontRegistry: any;

  beforeEach(() => {
    fontRegistry = createMockFontRegistry();
  });

  it("creates a shading when an SVG rect uses fill=url(#id) referencing a linearGradient in defs", async () => {
    const html = `
      <html>
        <body>
          <svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="red" />
                <stop offset="100%" stop-color="blue" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="200" height="100" fill="url(#g1)" />
          </svg>
        </body>
      </html>
    `;

    const prepared = await prepareHtmlRender({
      html,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    // Create a PagePainter similar to the render pipeline
    const painter = new PagePainter(pageHeightPt, pxToPt, fontRegistry);

    // Recursive search for svg boxes in the render tree root
    const svgBoxes: any[] = [];
    function collectSvg(box: any) {
      if (!box) return;
      if (box.tagName === "svg" && box.customData && box.customData.svg) {
        svgBoxes.push(box);
      }
      if (box.children && box.children.length) {
        for (const child of box.children) collectSvg(child);
      }
    }

    collectSvg(prepared.renderTree.root);

    expect(svgBoxes.length).toBeGreaterThan(0);

    // Render each svg box (render-svg should collect defs and wire gradients)
    for (const box of svgBoxes) {
      await renderSvgBox(painter, box);
    }

    const result = painter.result();
    // Expect at least one shading to have been created for the linearGradient
    expect(result.shadings.size).toBeGreaterThan(0);
    // Also expect the shading dictionary(s) to include ShadingType 2 (axial) or entries suggesting gradient
    let found = false;
    for (const [, dict] of result.shadings) {
      if (typeof dict !== "string") continue;
      // low-level assertions on the shading dictionary string
      // 1) contains ShadingType 2
      const hasType2 = /\/ShadingType\s+2/.test(dict);
      if (!hasType2) continue;
      // 2) contains Coords array with four numbers
      const coordsMatch = dict.match(/\/Coords\s*\[([^\]]+)\]/);
      expect(coordsMatch).toBeTruthy();
      if (coordsMatch) {
        const parts = coordsMatch[1].trim().split(/\s+/).map((s) => Number.parseFloat(s));
        // expect 4 numeric coords for axial shading
        expect(parts.length).toBe(4);
        // expect the third coord (x1) to be approx 200px -> in points that's 200 * 0.75 = 150
        const expectedX1 = 200 * 0.75;
        expect(Math.abs(parts[2] - expectedX1)).toBeLessThanOrEqual(0.01);
      }
      // 3) contains a Function dictionary (interpolation)
      expect(/\/Function\s+<</.test(dict)).toBeTruthy();
      // 4) contains color C0/C1 entries for color interpolation (basic check)
      expect(/\/C0\s*\[/.test(dict) || /\/Function/.test(dict)).toBeTruthy();
      found = true;
      break;
    }
    expect(found).toBeTruthy();
  });
});
