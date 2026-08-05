import { parseCss } from "../../src/html/css/parse-css.js";
import {
  resolveDefaultPageStyle,
  resolvePageStyleProfile,
} from "../../src/html/css/page-style.js";
import { prepareHtmlRender } from "../../src/html-to-pdf/prepare-html-render.js";
import type { RenderBox } from "../../src/pdf/types.js";
import { mmToPx, pxToPt } from "../../src/units/units.js";
import { DEFAULT_PAGE_HEIGHT_PX, DEFAULT_PAGE_WIDTH_PX } from "../../src/units/page-utils.js";

function findRenderBoxById(root: RenderBox, id: string): RenderBox {
  if (root.customData?.id === id) {
    return root;
  }
  for (const child of root.children) {
    const found = findRenderBoxByIdOrUndefined(child, id);
    if (found) {
      return found;
    }
  }
  throw new Error(`Missing render box ${id}`);
}

function findRenderBoxByIdOrUndefined(root: RenderBox, id: string): RenderBox | undefined {
  if (root.customData?.id === id) {
    return root;
  }
  for (const child of root.children) {
    const found = findRenderBoxByIdOrUndefined(child, id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

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

  it("cascades :first, :left and :right above generic page rules", () => {
    const parsed = parseCss(`
      @page { margin: 10px; }
      @page :left { margin-left: 30px; margin-top: 35px; }
      @page :right { margin-right: 40px; margin-left: 50px; }
      @page :first { margin-left: 60px; margin-top: 25px; }
      @page { margin-left: 12px; }
    `);
    const profile = resolvePageStyleProfile(parsed.pageRules, {
      width: DEFAULT_PAGE_WIDTH_PX,
      height: DEFAULT_PAGE_HEIGHT_PX,
    });

    expect(profile.default.margins).toEqual({ top: 10, right: 10, bottom: 10, left: 12 });
    expect(profile.left.margins).toEqual({ top: 35, right: 10, bottom: 10, left: 30 });
    expect(profile.right.margins).toEqual({ top: 10, right: 40, bottom: 10, left: 50 });
    expect(profile.first.margins).toEqual({ top: 25, right: 40, bottom: 10, left: 60 });
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

  it("maps content through variable first, left and right page margins", async () => {
    const prepared = await prepareHtmlRender({
      html: `
        <div id="first">First</div>
        <div id="left">Left</div>
        <div id="right">Right</div>
      `,
      css: `
        @page { size: 300px 200px; margin: 10px; }
        @page :right { margin: 40px 20px 10px 60px; }
        @page :left { margin: 30px 10px 10px 50px; }
        @page :first { margin: 20px 20px 30px 40px; }
        html, body, div { margin: 0; padding: 0; }
        div { height: 20px; }
        #left, #right { break-before: page; }
      `,
      pagedBodyMargin: "zero",
    });

    const first = findRenderBoxById(prepared.renderTree.root, "first");
    const left = findRenderBoxById(prepared.renderTree.root, "left");
    const right = findRenderBoxById(prepared.renderTree.root, "right");

    expect(first.borderBox.x).toBeCloseTo(40, 4);
    expect(first.borderBox.y).toBeCloseTo(20, 4);
    expect(left.borderBox.x).toBeCloseTo(50, 4);
    expect(left.borderBox.y).toBeCloseTo(230, 4);
    expect(right.borderBox.x).toBeCloseTo(60, 4);
    expect(right.borderBox.y).toBeCloseTo(440, 4);
  });

  it("keeps explicit API page options above every @page variant", async () => {
    const prepared = await prepareHtmlRender({
      html: "<p>Explicit API</p>",
      css: `
        @page { size: A4 landscape; margin: 30mm; }
        @page :first { margin-top: 50mm; margin-left: 60mm; }
      `,
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
    expect(prepared.renderTree.root.borderBox.x).toBeGreaterThanOrEqual(24);
  });
});
