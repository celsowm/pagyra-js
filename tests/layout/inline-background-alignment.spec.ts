import { describe, it, expect } from "vitest";
import { renderTreeForHtml, collectBoxes } from "../helpers/render-utils.js";

// Tolerance for position comparison (accounts for padding and minor layout differences)
const POSITION_TOLERANCE_PX = 10;
// Tolerance for width comparison (allows 10% difference)
const WIDTH_TOLERANCE_RATIO = 0.9;

describe("inline background alignment", () => {
    it("aligns background with text for inline span elements", async () => {
        const html = `
            <p>Normal text <span style="background-color: yellow">highlighted text</span> after.</p>
        `;
        const renderTree = await renderTreeForHtml(html);
        const boxes = collectBoxes(renderTree.root);
        
        // Find the span element
        const spanBox = boxes.find(b => b.tagName === "span");
        expect(spanBox).toBeDefined();
        
        // Find the text node inside the span (should be a child with textRuns)
        const textNodeInsideSpan = spanBox?.children.find(c => c.textRuns && c.textRuns.length > 0);
        expect(textNodeInsideSpan).toBeDefined();
        
        if (spanBox && textNodeInsideSpan && textNodeInsideSpan.textRuns && textNodeInsideSpan.textRuns.length > 0) {
            // The span's borderBox.x should be at or before the first text run's position
            const firstRunX = textNodeInsideSpan.textRuns[0].lineMatrix?.e ?? 0;
            const spanBorderX = spanBox.borderBox.x;
            
            // The span's border box X should match or be very close to where the first text run starts
            // (accounting for any padding)
            expect(Math.abs(spanBorderX - firstRunX)).toBeLessThan(POSITION_TOLERANCE_PX);
            
            // The span should have a background color
            expect(spanBox.background?.color).toBeDefined();
        }
    });
    
    it("calculates correct width for inline span with multiple text fragments", async () => {
        const html = `
            <p>Before <span style="background-color: lightblue">text one two three</span> after.</p>
        `;
        const renderTree = await renderTreeForHtml(html);
        const boxes = collectBoxes(renderTree.root);
        
        const spanBox = boxes.find(b => b.tagName === "span");
        expect(spanBox).toBeDefined();
        
        if (spanBox && spanBox.children.length > 0) {
            const textNode = spanBox.children[0];
            if (textNode.textRuns && textNode.textRuns.length > 0) {
                // Find the extent of all text runs
                let minX = Infinity;
                let maxX = -Infinity;
                
                for (const run of textNode.textRuns) {
                    const runX = run.lineMatrix?.e ?? 0;
                    const runWidth = run.advanceWidth ?? 0;
                    minX = Math.min(minX, runX);
                    maxX = Math.max(maxX, runX + runWidth);
                }
                
                // The span's border box should cover the text content
                const spanWidth = spanBox.borderBox.width;
                const textExtent = maxX - minX;
                
                // The span width should be at least as wide as the text extent
                expect(spanWidth).toBeGreaterThanOrEqual(textExtent * WIDTH_TOLERANCE_RATIO);
            }
        }
    });
    
    it("positions background correctly when span follows other content", async () => {
        const html = `
            <p>Some initial text <span style="background-color: pink">highlighted</span> end.</p>
        `;
        const renderTree = await renderTreeForHtml(html);
        const boxes = collectBoxes(renderTree.root);
        
        const spanBox = boxes.find(b => b.tagName === "span");
        
        expect(spanBox).toBeDefined();
        
        if (spanBox) {
            // The span's borderBox.x should be positive (not at the start of the line)
            // since it comes after "Some initial text "
            expect(spanBox.borderBox.x).toBeGreaterThan(0);
            
            // The span should have a background
            expect(spanBox.background?.color).toBeDefined();
        }
    });
});
