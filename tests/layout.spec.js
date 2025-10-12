import { describe, expect, it } from "vitest";
import { ComputedStyle, Display, FloatMode, LayoutNode, layoutTree, } from "../src/index.js";
describe("layout engine", () => {
    it("wraps inline nodes across multiple lines", () => {
        const root = new LayoutNode(new ComputedStyle());
        const paragraph = new LayoutNode(new ComputedStyle({ display: Display.Block }));
        root.appendChild(paragraph);
        const inlineA = new LayoutNode(new ComputedStyle({ display: Display.Inline }), [], { textContent: "A".repeat(12) });
        const inlineB = new LayoutNode(new ComputedStyle({ display: Display.Inline }), [], { textContent: "B".repeat(14) });
        paragraph.appendChild(inlineA);
        paragraph.appendChild(inlineB);
        layoutTree(root, { width: 180, height: 400 });
        expect(paragraph.establishesIFC).toBe(true);
        expect(inlineA.box.y).toBeLessThan(inlineB.box.y);
        expect(Math.round(inlineA.box.x)).toBe(Math.round(inlineB.box.x));
        expect(paragraph.box.contentHeight).toBeGreaterThan(inlineA.box.contentHeight);
    });
    it("layouts text around floats and restores width after float ends", () => {
        const root = new LayoutNode(new ComputedStyle());
        const floatBox = new LayoutNode(new ComputedStyle({
            display: Display.Block,
            float: FloatMode.Left,
            width: 120,
            height: 30,
            marginRight: 8,
        }));
        const inlineStyle = () => new ComputedStyle({ display: Display.Inline });
        const inline1 = new LayoutNode(inlineStyle(), [], { textContent: "Flowing text." });
        const inline2 = new LayoutNode(inlineStyle(), [], { textContent: "Another inline chunk." });
        const inline3 = new LayoutNode(inlineStyle(), [], { textContent: "Trailing text after float restores width." });
        root.appendChild(floatBox);
        root.appendChild(inline1);
        root.appendChild(inline2);
        root.appendChild(inline3);
        layoutTree(root, { width: 360, height: 400 });
        expect(floatBox.box.x).toBeGreaterThanOrEqual(0);
        expect(floatBox.box.y).toBe(0);
        expect(inline1.box.x).toBeGreaterThan(floatBox.box.x);
        expect(inline2.box.x).toBeGreaterThanOrEqual(inline1.box.x);
        expect(inline3.box.x).toBeLessThan(inline2.box.x);
        expect(inline3.box.x).toBeLessThan(10);
        const floatBottom = floatBox.box.y + floatBox.box.marginBoxHeight;
        expect(inline3.box.y).toBeGreaterThan(floatBottom);
    });
});
