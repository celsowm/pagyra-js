import { describe, expect, it } from "vitest";
import { prepareHtmlRender } from "../src/html-to-pdf.js";
function findNode(root, tagName) {
    let result;
    root.walk((node) => {
        if (result) {
            return;
        }
        if (node.tagName?.toLowerCase() === tagName) {
            result = node;
        }
    });
    if (!result) {
        throw new Error(`Unable to locate <${tagName}> in layout tree`);
    }
    return result;
}
function findAllNodes(root, tagName) {
    const matches = [];
    root.walk((node) => {
        if (node.tagName?.toLowerCase() === tagName) {
            matches.push(node);
        }
    });
    return matches;
}
async function renderTable(css) {
    const { layoutRoot } = await prepareHtmlRender({
        html: `
      <html>
        <body>
          <table>
            <tr><th>H</th><td>D</td></tr>
            <tr><th>H2</th><td>D2</td></tr>
          </table>
        </body>
      </html>
    `,
        css,
        viewportWidth: 800,
        viewportHeight: 600,
        pageWidth: 800,
        pageHeight: 600,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return layoutRoot;
}
describe("border parsing", () => {
    it("handles border shorthand with width, style, and color", async () => {
        const root = await renderTable("th, td { border: 5px solid red; }");
        const th = findNode(root, "th");
        const td = findNode(root, "td");
        expect(th.style.borderTop).toBeCloseTo(5);
        expect(th.style.borderRight).toBeCloseTo(5);
        expect(th.style.borderBottom).toBeCloseTo(5);
        expect(th.style.borderLeft).toBeCloseTo(5);
        expect(th.style.borderColor).toBe("red");
        expect(td.style.borderTop).toBeCloseTo(5);
        expect(td.style.borderRight).toBeCloseTo(5);
        expect(td.style.borderBottom).toBeCloseTo(5);
        expect(td.style.borderLeft).toBeCloseTo(5);
        expect(td.style.borderColor).toBe("red");
    });
    it("converts pt border widths and respects per-side shorthand", async () => {
        const root = await renderTable("th { border-top: 4pt dotted blue; }");
        const th = findNode(root, "th");
        const expected = (4 / 72) * 96;
        expect(th.style.borderTop).toBeCloseTo(expected, 5);
        expect(th.style.borderRight ?? 0).toBe(0);
        expect(th.style.borderColor).toBe("blue");
    });
    it("honours border-style none overrides", async () => {
        const root = await renderTable("td { border: 5px solid red; border-style: none; }");
        const td = findNode(root, "td");
        expect(td.style.borderTop ?? 0).toBe(0);
        expect(td.style.borderRight ?? 0).toBe(0);
        expect(td.style.borderBottom ?? 0).toBe(0);
        expect(td.style.borderLeft ?? 0).toBe(0);
    });
    it("collapses adjoining borders without doubling width", async () => {
        const css = `
      table { border-collapse: collapse; }
      th, td { border: 1px solid #d30a0a; }
    `;
        const root = await renderTable(css);
        const tds = findAllNodes(root, "td");
        expect(tds.length).toBeGreaterThanOrEqual(2);
        const firstRowCell = tds[0];
        const secondRowCell = tds[1];
        expect(firstRowCell.style.borderTop ?? 0).toBeCloseTo(1);
        expect(firstRowCell.style.borderBottom ?? 0).toBe(0);
        expect(secondRowCell.style.borderTop ?? 0).toBeCloseTo(1);
        expect(secondRowCell.style.borderBottom ?? 0).toBeCloseTo(1);
        expect(secondRowCell.style.borderColor).toBe("#d30a0a");
    });
});
