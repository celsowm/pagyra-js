import { describe, it, expect, beforeEach, vi } from "vitest";
import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import { PagePainter } from "../../src/pdf/page-painter.js";
import { renderSvgBox } from "../../src/pdf/svg/render-svg.js";

// Minimal mock font registry (same shape used in other tests)
const createMockFontRegistry = () => {
  return {
    ensureFontResource: vi.fn().mockResolvedValue({ baseFont: "Helvetica", resourceName: "F1", ref: { objectNumber: 1 }, isBase14: true }),
    ensureFontResourceSync: vi.fn().mockReturnValue({ baseFont: "Helvetica", resourceName: "F1", ref: { objectNumber: 1 }, isBase14: true }),
    initializeEmbedder: vi.fn().mockResolvedValue(undefined),
    setFontConfig: vi.fn(),
    getEmbedder: vi.fn().mockReturnValue(null),
  } as any;
};

describe("SVG radial defs rendering (integration)", () => {
  const pxToPt = (px: number) => px * 0.75;
  const pageHeightPt = 841.89;
  let fontRegistry: any;

  beforeEach(() => {
    fontRegistry = createMockFontRegistry();
  });

  it("creates a radial shading for objectBoundingBox coords (ratio)", async () => {
    const html = `
      <html>
        <body>
          <svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="rg1" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stop-color="red" />
                <stop offset="100%" stop-color="blue" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="200" height="100" fill="url(#rg1)" />
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

    const painter = new PagePainter(pageHeightPt, pxToPt, fontRegistry);

    const svgBoxes: any[] = [];
    function collectSvg(box: any) {
      if (!box) return;
      if (box.tagName === "svg" && box.customData && box.customData.svg) svgBoxes.push(box);
      if (box.children && box.children.length) for (const c of box.children) collectSvg(c);
    }
    collectSvg(prepared.renderTree.root);
    expect(svgBoxes.length).toBeGreaterThan(0);

    for (const box of svgBoxes) {
      await renderSvgBox(painter, box);
    }

    const result = painter.result();
    expect(result.shadings.size).toBeGreaterThan(0);

    let found = false;
    for (const [, dict] of result.shadings) {
      if (typeof dict !== "string") continue;
      if (!/\/ShadingType\s+3/.test(dict)) continue;
      const coordsMatch = dict.match(/\/Coords\s*\[([^\]]+)\]/);
      expect(coordsMatch).toBeTruthy();
      if (coordsMatch) {
        const parts = coordsMatch[1].trim().split(/\s+/).map((s) => Number.parseFloat(s));
        expect(parts.length).toBe(6);
        // Last three numbers are x1 y1 r1 (outer circle center & radius)
        const lastThree = parts.slice(3);
        // Expected for rect 200x100 (pts): widthPt=150, heightPt=75, centerX=75, centerY=37.5, radius = max(150,75)*0.5 = 75
        expect(Math.abs(lastThree[0] - 75)).toBeLessThanOrEqual(0.02);
        expect(Math.abs(lastThree[1] - 37.5)).toBeLessThanOrEqual(0.02);
        expect(Math.abs(lastThree[2] - 75)).toBeLessThanOrEqual(0.02);
      }
      found = true;
      break;
    }
    expect(found).toBeTruthy();
  });

  it("creates a radial shading for userSpaceOnUse coords (absolute px)", async () => {
    const html = `
      <html>
        <body>
          <svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="rg2" gradientUnits="userSpaceOnUse" cx="100" cy="50" r="50">
                <stop offset="0%" stop-color="red" />
                <stop offset="100%" stop-color="blue" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="200" height="100" fill="url(#rg2)" />
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

    const painter = new PagePainter(pageHeightPt, pxToPt, fontRegistry);

    const svgBoxes: any[] = [];
    function collectSvg(box: any) {
      if (!box) return;
      if (box.tagName === "svg" && box.customData && box.customData.svg) svgBoxes.push(box);
      if (box.children && box.children.length) for (const c of box.children) collectSvg(c);
    }
    collectSvg(prepared.renderTree.root);
    expect(svgBoxes.length).toBeGreaterThan(0);

    for (const box of svgBoxes) {
      await renderSvgBox(painter, box);
    }

    const result = painter.result();
    expect(result.shadings.size).toBeGreaterThan(0);

    let found = false;
    for (const [, dict] of result.shadings) {
      if (typeof dict !== "string") continue;
      if (!/\/ShadingType\s+3/.test(dict)) continue;
      const coordsMatch = dict.match(/\/Coords\s*\[([^\]]+)\]/);
      expect(coordsMatch).toBeTruthy();
      if (coordsMatch) {
        const parts = coordsMatch[1].trim().split(/\s+/).map((s) => Number.parseFloat(s));
        expect(parts.length).toBe(6);
        const lastThree = parts.slice(3);
        // UserSpace: cx=100px -> 75pt, cy=50px -> 37.5pt, r=50px -> 37.5pt
        expect(Math.abs(lastThree[0] - 75)).toBeLessThanOrEqual(0.02);
        expect(Math.abs(lastThree[1] - 37.5)).toBeLessThanOrEqual(0.02);
        expect(Math.abs(lastThree[2] - 37.5)).toBeLessThanOrEqual(0.02);
      }
      found = true;
      break;
    }
    expect(found).toBeTruthy();
  });

  it("applies gradientTransform to ratio radial gradients", async () => {
    const html = `
      <html>
        <body>
          <svg width="200" height="100" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="rg3" cx="0.5" cy="0.5" r="0.5" gradientTransform="scale(2,1)">
                <stop offset="0%" stop-color="red" />
                <stop offset="100%" stop-color="blue" />
              </radialGradient>
            </defs>
            <rect x="0" y="0" width="200" height="100" fill="url(#rg3)" />
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

    const painter = new PagePainter(pageHeightPt, pxToPt, fontRegistry);

    const svgBoxes: any[] = [];
    function collectSvg(box: any) {
      if (!box) return;
      if (box.tagName === "svg" && box.customData && box.customData.svg) svgBoxes.push(box);
      if (box.children && box.children.length) for (const c of box.children) collectSvg(c);
    }
    collectSvg(prepared.renderTree.root);
    expect(svgBoxes.length).toBeGreaterThan(0);

    for (const box of svgBoxes) {
      await renderSvgBox(painter, box);
    }

    const result = painter.result();
    expect(result.shadings.size).toBeGreaterThan(0);

    let found = false;
    for (const [, dict] of result.shadings) {
      if (typeof dict !== "string") continue;
      if (!/\/ShadingType\s+3/.test(dict)) continue;
      const coordsMatch = dict.match(/\/Coords\s*\[([^\]]+)\]/);
      expect(coordsMatch).toBeTruthy();
      if (coordsMatch) {
        const parts = coordsMatch[1].trim().split(/\s+/).map((s) => Number.parseFloat(s));
        expect(parts.length).toBe(6);
        const lastThree = parts.slice(3);
        // With gradientTransform scale(2,1), the ratio coords are scaled in X before mapping to rect points.
        // For rect 200x100 -> widthPt=150, heightPt=75. Original center (0.5,0.5) maps to (75,37.5) but transform moves center to (1.0,0.5)-> x=150
        // edge point becomes (1.0+0.5)=1.5 -> after scale(2,1) edge maps to x=300 -> radius=distance(edge,center)=150
        expect(Math.abs(lastThree[0] - 150)).toBeLessThanOrEqual(0.02);
        expect(Math.abs(lastThree[1] - 37.5)).toBeLessThanOrEqual(0.02);
        expect(Math.abs(lastThree[2] - 150)).toBeLessThanOrEqual(0.02);
      }
      found = true;
      break;
    }
    expect(found).toBeTruthy();
  });
});
