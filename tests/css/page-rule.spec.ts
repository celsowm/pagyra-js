import { parseCss } from "../../src/html/css/parse-css.js";
import { resolveDefaultPageStyle } from "../../src/html/css/page-style.js";
import { prepareHtmlRender } from "../../src/html-to-pdf/prepare-html-render.js";
import { mmToPx, pxToPt } from "../../src/units/units.js";
import { DEFAULT_PAGE_HEIGHT_PX, DEFAULT_PAGE_WIDTH_PX } from "../../src/units/page-utils.js";

describe("@page descriptors", () => {
  it("preserves default page rules and resolves ordered descriptors", () => {
    const parsed = parseCss(`
      @page { size: 200mm 300mm; margin: 10mm 20mm; }
      @page { margin-left: 30mm; }
      @page report { size: letter; margin: 1in; }
    `);

    expect(parsed.pageRules).toHaveLength(3);
    const resolved = resolveDefaultPageStyle(parsed.pageRules, {
      width: DEFAULT_PAGE_WIDTH_PX,
      height: DEFAULT_PAGE_HEIGHT_PX,
    });

    expect(resolved.width).toBeCloseTo(mmToPx(200), 4);
    expect(resolved.height).toBeCloseTo(mmToPx(300), 4);
    expect(resolved.margins?.top).toBeCloseTo(mmToPx(10), 4);
    expect(resolved.margins?.right).toBeCloseTo(mmToPx(20), 4);
    expect(resolved.margins?.bottom).toBeCloseTo(mmToPx(10), 4);
    expect(resolved.margins?.left).toBeCloseTo(mmToPx(30), 4);
  });

  it("supports named page sizes and orientation", () => {
    const parsed = parseCss("@page { size: A4 landscape; }");
    const resolved = resolveDefaultPageStyle(parsed.pageRules, {
      width: DEFAULT_PAGE_WIDTH_PX,
      height: DEFAULT_PAGE_HEIGHT_PX,
    });

    expect(resolved.width).toBeCloseTo(mmToPx(297), 4);
    expect(resolved.height).toBeCloseTo(mmToPx(210), 4);
  });

  it("applies @page dimensions and margins to the prepared PDF", async () => {
    const prepared = await prepareHtmlRender({
      html: "<p>Page CSS</p>",
      css: "@page { size: 200mm 300mm; margin: 10mm 20mm 30mm 40mm; }",
      pagedBodyMargin: "zero",
    });

    expect(prepared.pageSize.widthPt).toBeCloseTo(pxToPt(mmToPx(200)), 3);
    expect(prepared.pageSize.heightPt).toBeCloseTo(pxToPt(mmToPx(300)), 3);
    expect(prepared.margins.top).toBeCloseTo(mmToPx(10), 3);
    expect(prepared.margins.right).toBeCloseTo(mmToPx(20), 3);
    expect(prepared.margins.bottom).toBeCloseTo(mmToPx(30), 3);
    expect(prepared.margins.left).toBeCloseTo(mmToPx(40), 3);
  });

  it("keeps explicit API page options above @page", async () => {
    const prepared = await prepareHtmlRender({
      html: "<p>Explicit API</p>",
      css: "@page { size: A4 landscape; margin: 30mm; }",
      pageWidth: 640,
      pageHeight: 900,
      margins: { top: 12, left: 24 },
      pagedBodyMargin: "zero",
    });

    expect(prepared.pageSize.widthPt).toBeCloseTo(pxToPt(640), 4);
    expect(prepared.pageSize.heightPt).toBeCloseTo(pxToPt(900), 4);
    expect(prepared.margins.top).toBe(12);
    expect(prepared.margins.left).toBe(24);
    expect(prepared.margins.right).toBeCloseTo(mmToPx(30), 4);
    expect(prepared.margins.bottom).toBeCloseTo(mmToPx(30), 4);
  });
});
