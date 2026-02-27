import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import type { RenderBox, Run } from "../../src/pdf/types.js";

const DEFAULT_TEST_PAGE = {
    viewportWidth: 794,
    viewportHeight: 1123,
    pageWidth: 794,
    pageHeight: 1123,
};

// Keep legacy fixture behavior stable: these tests historically rendered with 48px
// effective margins because prepareHtmlRender ignored helper-provided margins.
const DEFAULT_TEST_MARGINS = { top: 48, right: 48, bottom: 48, left: 48 };

export interface RenderHelperOptions {
    viewportWidth?: number;
    viewportHeight?: number;
    pageWidth?: number;
    pageHeight?: number;
    margins?: Partial<typeof DEFAULT_TEST_MARGINS>;
    pagedBodyMargin?: "auto" | "zero";
    interBlockWhitespace?: "collapse" | "preserve";
}

export async function renderRuns(html: string, css = "", options: RenderHelperOptions = {}): Promise<Run[]> {
    const wrappedHtml =
        /<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`;

    const { renderTree } = await prepareHtmlRender({
        html: wrappedHtml,
        css,
        viewportWidth: options.viewportWidth ?? DEFAULT_TEST_PAGE.viewportWidth,
        viewportHeight: options.viewportHeight ?? DEFAULT_TEST_PAGE.viewportHeight,
        pageWidth: options.pageWidth ?? DEFAULT_TEST_PAGE.pageWidth,
        pageHeight: options.pageHeight ?? DEFAULT_TEST_PAGE.pageHeight,
        margins: options.margins ?? DEFAULT_TEST_MARGINS,
        pagedBodyMargin: options.pagedBodyMargin ?? "auto",
        interBlockWhitespace: options.interBlockWhitespace ?? "collapse",
    });

    return collectRuns(renderTree.root);
}

export async function renderTreeForHtml(html: string, css = "", options: RenderHelperOptions = {}) {
    const wrappedHtml =
        /<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`;

    const { renderTree } = await prepareHtmlRender({
        html: wrappedHtml,
        css,
        viewportWidth: options.viewportWidth ?? DEFAULT_TEST_PAGE.viewportWidth,
        viewportHeight: options.viewportHeight ?? DEFAULT_TEST_PAGE.viewportHeight,
        pageWidth: options.pageWidth ?? DEFAULT_TEST_PAGE.pageWidth,
        pageHeight: options.pageHeight ?? DEFAULT_TEST_PAGE.pageHeight,
        margins: options.margins ?? DEFAULT_TEST_MARGINS,
        pagedBodyMargin: options.pagedBodyMargin ?? "auto",
        interBlockWhitespace: options.interBlockWhitespace ?? "collapse",
    });

    return renderTree;
}

export function collectRuns(box: RenderBox): Run[] {
    const runs: Run[] = [...(box.textRuns ?? [])];
    for (const child of box.children) {
        runs.push(...collectRuns(child));
    }
    return runs;
}

export function collectBoxes(box: RenderBox): RenderBox[] {
    const boxes: RenderBox[] = [box];
    for (const child of box.children) {
        boxes.push(...collectBoxes(child));
    }
    return boxes;
}
