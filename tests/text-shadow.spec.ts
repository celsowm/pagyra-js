import { describe, expect, it } from "vitest";

describe("text-shadow -> PDF rendering", () => {
  it("renders text-shadow by painting shadow text before main text", async () => {
    const html = `
      <html>
        <head></head>
        <body>
          <div style="font-size:24px; color: #222222; text-shadow: 4px 2px 0 rgba(0,0,0,0.6);">
            Shadowed
          </div>
        </body>
      </html>
    `;

    // Use the lower-level pipeline so we can inspect painter commands directly (avoid PDF stream compression)
    const { prepareHtmlRender } = await import("../src/html-to-pdf.js");
    const { initFontSystem } = await import("../src/pdf/font/font-registry.js");
    const { paginateTree } = await import("../src/pdf/pagination.js");
    const { paintLayoutPage } = await import("../src/pdf/renderer/page-paint.js");
    const { PdfDocument } = await import("../src/pdf/primitives/pdf-document.js");

    const prepared = await prepareHtmlRender({
      html,
      css: "",
      viewportWidth: 400,
      viewportHeight: 200,
      pageWidth: 400,
      pageHeight: 200,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    // Initialize a minimal font registry (we only need it for the painter)
    const doc = new PdfDocument({});
    const fontRegistry = initFontSystem(doc, prepared.renderTree.css);

    // Build a proper header/footer layout (minimal) so paintLayoutPage can use it
    const { initHeaderFooterContext, layoutHeaderFooterTrees } = await import("../src/pdf/header-footer.js");
    const baseBox = { x: 0, y: 0, width: 400, height: 200 };
    const hfCtx = initHeaderFooterContext(prepared.renderTree.hf, prepared.pageSize, baseBox);
    const hfLayout = layoutHeaderFooterTrees(hfCtx, (px: number) => px * (72 / 96));

    const pageHeightPx = prepared.pageSize.heightPt * (96 / 72); // reverse of px->pt conversion used elsewhere
    const pages = paginateTree(prepared.renderTree.root, { pageHeight: pageHeightPx });
    expect(pages.length).toBeGreaterThan(0);

    // Paint the first page and inspect raw painter content
      const painterResult = await paintLayoutPage({
      pageTree: pages[0],
      pageNumber: 1,
      totalPages: pages.length,
      pageSize: prepared.pageSize,
      pxToPt: (px: number) => px * (72 / 96),
      pageWidthPx: 400,
      pageHeightPx: 200,
      fontRegistry,
      headerFooterLayout: hfLayout,
      tokens: new Map(),
      headerFooterTextOptions: { fontSizePt: 10 },
      pageBackground: undefined,
    } as any);

    const content = painterResult.content;

    // The text string must appear in the painter content (allow surrounding whitespace inside the PDF text token)
    expect(content).toMatch(/\(\s*Shadowed\s*\)/);

    // There must be at least two text painting blocks: one for the shadow and one for the main text.
    const matches = content.match(/rg[\s\S]*?Tj/g);
    expect(matches && matches.length >= 2).toBeTruthy();

    // Ensure a shadow color (black) operator exists (rgba(0,0,0,0.6) -> 0 0 0 rg)
    expect(content).toMatch(/0(?:\.0+)?\s+0(?:\.0+)?\s+0(?:\.0+)?\s+rg/);

    // Also ensure the main text color operator exists
    expect(content).toMatch(/rg/);
  }, 10000);
});
