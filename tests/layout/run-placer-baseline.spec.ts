import { describe, it, expect, vi } from "vitest";
import { RunPlacer } from "../../src/layout/inline/run-placer.js";
import { LayoutNode } from "../../src/dom/node.js";
import { ComputedStyle } from "../../src/css/style.js";
import type { LayoutItem } from "../../src/layout/inline/types.js";
import type { FontEmbedder } from "../../src/pdf/font/embedder.js";

describe("RunPlacer", () => {
    it("uses font metrics for baseline calculation when FontEmbedder is provided", () => {
        const mockFontEmbedder = {
            getMetrics: vi.fn().mockReturnValue({
                metrics: {
                    unitsPerEm: 1000,
                    ascender: 800,
                    descender: -200,
                }
            })
        } as unknown as FontEmbedder;

        const placer = new RunPlacer(mockFontEmbedder);

        const style = new ComputedStyle({
            fontSize: 20,
            fontFamily: "TestFont",
            lineHeight: { kind: "length", value: 20 }
        });
        const node = new LayoutNode(style);

        const item: LayoutItem = {
            kind: "word",
            width: 50,
            height: 20,
            lineHeight: 20,
            node: node,
            style: style,
            text: "Test",
        };

        const lineContext = {
            lineTop: 100,
            lineHeight: 20,
            lineStartX: 0,
            lineIndex: 0,
            availableWidth: 100,
            offsetShift: 0,
            isLastLine: false,
            contentX: 0,
            inlineOffsetStart: 0,
        };

        placer.placeRunsForLine([{ item, offset: 0 }], lineContext);

        expect(mockFontEmbedder.getMetrics).toHaveBeenCalledWith("TestFont", 400, "normal");

        const runs = placer.getNodeRuns().get(node);
        expect(runs).toBeDefined();
        expect(runs!.length).toBe(1);

        // Baseline calculation:
        // ascent = (800 / 1000) * 20 = 16
        // leading = 20 - 20 = 0
        // halfLeading = 0
        // baseline = 100 + 0 + 16 = 116
        expect(runs![0].baseline).toBe(116);
    });

    it("uses default heuristic when FontEmbedder is not provided", () => {
        const placer = new RunPlacer(null);

        const style = new ComputedStyle({
            fontSize: 20,
            lineHeight: { kind: "length", value: 20 }
        });
        const node = new LayoutNode(style);

        const item: LayoutItem = {
            kind: "word",
            width: 50,
            height: 20,
            lineHeight: 20,
            node: node,
            style: style,
            text: "Test",
        };

        const lineContext = {
            lineTop: 100,
            lineHeight: 20,
            lineStartX: 0,
            lineIndex: 0,
            availableWidth: 100,
            offsetShift: 0,
            isLastLine: false,
            contentX: 0,
            inlineOffsetStart: 0,
        };

        placer.placeRunsForLine([{ item, offset: 0 }], lineContext);

        const runs = placer.getNodeRuns().get(node);
        expect(runs).toBeDefined();

        // Default heuristic:
        // ascent = 20 * 0.75 = 15
        // baseline = 100 + 15 = 115
        expect(runs![0].baseline).toBe(115);
    });
});
