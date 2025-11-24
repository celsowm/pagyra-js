import { prepareHtmlRender } from "./dist/src/html-to-pdf.js";

const html = `
  <p style="text-align: justify; width: 200px">normal <b>bold</b> normal</p>
`;

const { renderTree } = await prepareHtmlRender({
    html,
    css: "",
    viewportWidth: 794,
    viewportHeight: 1123,
    pageWidth: 794,
    pageHeight: 1123,
    margins: { top: 96, right: 96, bottom: 96, left: 96 },
});

function inspectBox(box, depth = 0) {
    const indent = "  ".repeat(depth);
    console.log(`${indent}Box: ${box.tagName || 'anonymous'}, textAlign: ${box.textAlign || 'none'}, runs: ${box.textRuns?.length || 0}`);

    if (box.textRuns && box.textRuns.length > 0) {
        box.textRuns.forEach((run, i) => {
            const x = run.lineMatrix?.e ?? 0;
            const width = run.advanceWidth ?? 0;
            console.log(`${indent}  Run[${i}]: "${run.text}" x=${x.toFixed(2)} w=${width.toFixed(2)} lineIdx=${run.lineIndex} spaces=${run.spacesInRun} ws=${run.wordSpacing?.toFixed(2) ?? 'none'}`);
        });
    }

    for (const child of box.children) {
        inspectBox(child, depth + 1);
    }
}

console.log("=== Render Tree Structure ===\n");
inspectBox(renderTree.root);
