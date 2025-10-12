export * from "./core.js";
export * from "./html-to-pdf.js";
import { LayoutNode } from "./dom/node.js";
import { ComputedStyle } from "./css/style.js";
import { layoutTree } from "./layout/pipeline/layout-tree.js";
export function demoLayout(viewport = { width: 800, height: 600 }) {
    const root = new LayoutNode(new ComputedStyle());
    const paragraph = new LayoutNode(new ComputedStyle({
        marginTop: 16,
        marginBottom: 16,
    }));
    root.appendChild(paragraph);
    layoutTree(root, viewport);
    return root;
}
import { fileURLToPath } from "node:url";
const isMain = fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
    const tree = demoLayout();
    console.log("Root layout:", {
        width: tree.box.contentWidth,
        height: tree.box.contentHeight,
        children: tree.children.length,
    });
}
