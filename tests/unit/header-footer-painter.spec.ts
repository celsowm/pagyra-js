import { describe, it, expect, vi } from "vitest";
import { paintHeaderFooter } from "../../src/pdf/header-footer-painter.js";
import type { HeaderFooterVariant } from "../../src/pdf/header-footer-layout.js";
import type { PagePainter } from "../../src/pdf/page-painter.js";

const header: HeaderFooterVariant = { content: "Page {page}", maxHeightPx: 24, maxHeightPt: 18 };
const footer: HeaderFooterVariant = { content: "Total {pages}", maxHeightPx: 24, maxHeightPt: 18 };

describe("header-footer-painter", () => {
  it("renders header and footer text using placeholders", () => {
    const drawText = vi.fn();
    const painter = { drawText, pageHeightPx: 200 } as unknown as PagePainter;
    const tokens = new Map<string, string | ((page: number, total: number) => string)>();
    tokens.set("page", (page) => `#${page}`);
    tokens.set("pages", (_page, total) => `${total}`);

    paintHeaderFooter(painter, header, footer, tokens, 2, 4, { fontSizePt: 12 });

    expect(drawText).toHaveBeenCalledTimes(2);
    expect(drawText.mock.calls[0][0]).toContain("#2");
    expect(drawText.mock.calls[1][0]).toContain("4");
    expect(drawText.mock.calls[1][2]).toBe(200 - (24 + 16));
  });
});
