import { describe, expect, it } from "vitest";
import { paintHeaderFooter } from "../../src/pdf/header-footer-painter.js";
import { PagePainter } from "../../src/pdf/page-painter.js";
import { PdfDocument } from "../../src/pdf/primitives/pdf-document.js";
import { FontRegistry } from "../../src/pdf/font/font-registry.js";

describe("header/footer clip overflow", () => {
  function createPainter() {
    const doc = new PdfDocument({});
    const fontRegistry = new FontRegistry(doc, { fontFaces: [] });
    const painter = new PagePainter(300, (v) => v, fontRegistry, 0);
    return { painter, fontRegistry };
  }

  it("clips header rendering to max height when clipOverflow=true", async () => {
    const { painter, fontRegistry } = createPainter();

    await paintHeaderFooter(
      painter,
      {
        content: "<div style=\"height:120px;background:#000\"></div>",
        maxHeightPt: 24,
        maxHeightPx: 24,
      },
      undefined,
      new Map(),
      1,
      1,
      { fontSizePt: 10 },
      true,
      {
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        pageWidthPx: 200,
        pageHeightPx: 300,
        fontRegistry,
        pageOffsetY: 0,
        clipOverflow: true,
      },
    );

    expect(painter.result().content).toContain("W n");
  });

  it("does not clip header rendering when clipOverflow=false", async () => {
    const { painter, fontRegistry } = createPainter();

    await paintHeaderFooter(
      painter,
      {
        content: "<div style=\"height:120px;background:#000\"></div>",
        maxHeightPt: 24,
        maxHeightPx: 24,
      },
      undefined,
      new Map(),
      1,
      1,
      { fontSizePt: 10 },
      true,
      {
        margins: { top: 10, right: 10, bottom: 10, left: 10 },
        pageWidthPx: 200,
        pageHeightPx: 300,
        fontRegistry,
        pageOffsetY: 0,
        clipOverflow: false,
      },
    );

    expect(painter.result().content).not.toContain("W n");
  });
});
