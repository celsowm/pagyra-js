import { describe, expect, it } from "vitest";
import { LayoutNode } from "../src/dom/node.js";
import { ComputedStyle } from "../src/css/style.js";
import { Display } from "../src/css/enums.js";
import { layoutTree } from "../src/layout/pipeline/layout-tree.js";
import { buildRenderTree } from "../src/pdf/layout-tree-builder.js";
import { renderPdf } from "../src/pdf/render.js";
describe("PDF renderer", () => {
    it("converts a layout tree into a PDF binary", async () => {
        const root = createSampleLayout();
        layoutTree(root, { width: 320, height: 480 });
        const renderable = buildRenderTree(root);
        const pdfBytes = await renderPdf(renderable);
        expect(pdfBytes).toBeInstanceOf(Uint8Array);
        const header = Buffer.from(pdfBytes.subarray(0, 4)).toString("ascii");
        expect(header).toBe("%PDF");
        const trailer = Buffer.from(pdfBytes.subarray(pdfBytes.length - 6)).toString("ascii");
        expect(trailer.trim()).toBe("%%EOF");
    });
    it("evaluates header placeholders when rendering", async () => {
        const root = createSampleLayout();
        layoutTree(root, { width: 320, height: 480 });
        const renderable = buildRenderTree(root, {
            headerFooter: { headerHtml: "Page {page} of {pages}", maxHeaderHeightPx: 32 },
        });
        const pdfBytes = await renderPdf(renderable);
        const content = Buffer.from(pdfBytes).toString("ascii");
        expect(content).toContain("(Page 1 of 1)");
    });
    it("paints backgrounds and borders based on computed style", async () => {
        const root = new LayoutNode(new ComputedStyle());
        const block = new LayoutNode(new ComputedStyle({
            display: Display.Block,
            paddingTop: 8,
            paddingRight: 8,
            paddingBottom: 8,
            paddingLeft: 8,
            borderTop: 4,
            borderRight: 4,
            borderBottom: 4,
            borderLeft: 4,
            backgroundColor: "#336699",
            borderColor: "#000000",
        }));
        root.appendChild(block);
        layoutTree(root, { width: 200, height: 200 });
        const renderable = buildRenderTree(root);
        const pdfBytes = await renderPdf(renderable);
        const content = Buffer.from(pdfBytes).toString("ascii");
        expect(content).toMatch(/0\.2 0\.4 0\.6 rg\s+[0-9\.\-]+\s+[0-9\.\-]+\s+[0-9\.\-]+\s+[0-9\.\-]+\s+re\s+f/);
        expect(content).toMatch(/0 0 0 rg\s+[0-9\.\-]+\s+[0-9\.\-]+\s+[0-9\.\-]+\s+[0-9\.\-]+\s+re\s+f/);
    });
    it("renders inline text content as text operators", async () => {
        const root = new LayoutNode(new ComputedStyle());
        const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block, marginTop: 8, marginBottom: 8 }));
        const text = new LayoutNode(new ComputedStyle({ display: Display.Inline, color: "#111111", fontSize: 14, fontFamily: "Courier New" }), [], { textContent: "Hello inline world" });
        paragraph.appendChild(text);
        root.appendChild(paragraph);
        layoutTree(root, { width: 240, height: 320 });
        const renderable = buildRenderTree(root);
        const pdfBytes = await renderPdf(renderable);
        const content = Buffer.from(pdfBytes).toString("ascii");
        expect(content).toContain("(Hello inline world)");
        expect(content).toMatch(/\/F\d+\s+10\.5\b/);
    });
    it("selects base fonts from CSS font-face local sources", async () => {
        const root = createSampleLayout();
        layoutTree(root, { width: 320, height: 480 });
        const renderable = buildRenderTree(root, {
            headerFooter: { headerHtml: "Hello world", maxHeaderHeightPx: 24, fontFamily: "Times New Roman" },
            stylesheets: {
                fontFaces: [
                    {
                        family: "Times New Roman",
                        src: ['local("Times New Roman")'],
                    },
                ],
            },
        });
        const pdfBytes = await renderPdf(renderable);
        const content = Buffer.from(pdfBytes).toString("ascii");
        expect(content).toContain("/BaseFont /Times-Roman");
    });
});
function createSampleLayout() {
    const root = new LayoutNode(new ComputedStyle());
    const block = new LayoutNode(new ComputedStyle({ display: Display.Block }));
    const child = new LayoutNode(new ComputedStyle({ display: Display.Block, marginTop: 8, marginBottom: 8 }));
    root.appendChild(block);
    block.appendChild(child);
    return root;
}
