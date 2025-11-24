import { prepareHtmlRender } from "../../src/html-to-pdf.js";
import type { RenderBox, Run } from "../../src/pdf/types.js";

export async function renderRuns(html: string, css = ""): Promise<Run[]> {
    const wrappedHtml =
        /<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`;

    const { renderTree } = await prepareHtmlRender({
        html: wrappedHtml,
        css,
        viewportWidth: 794,
        viewportHeight: 1123,
        pageWidth: 794,
        pageHeight: 1123,
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
    });

    return collectRuns(renderTree.root);
}

export async function renderTreeForHtml(html: string, css = "") {
    const wrappedHtml =
        /<html[\s>]/i.test(html) ? html : `<html><body>${html}</body></html>`;

    const { renderTree } = await prepareHtmlRender({
        html: wrappedHtml,
        css,
        viewportWidth: 794,
        viewportHeight: 1123,
        pageWidth: 794,
        pageHeight: 1123,
        margins: { top: 96, right: 96, bottom: 96, left: 96 },
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
