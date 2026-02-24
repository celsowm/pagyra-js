import { RunPlacer } from "../../src/layout/inline/run-placer.js";
import { LayoutNode } from "../../src/dom/node.js";
import { ComputedStyle } from "../../src/css/style.js";
import type { LayoutItem } from "../../src/layout/inline/types.js";
import type { FontEmbedder } from "../../src/pdf/font/embedder.js";
import { calculateBaseline } from "../../src/layout/inline/font-baseline-calculator.js";

describe("RunPlacer", () => {
    it("uses the shared lineBaseline from LineContext for all runs", () => {
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

        // Pre-compute the line baseline (as layout.ts would)
        const lineBaseline = calculateBaseline(100, 20, 20, {
            metrics: { unitsPerEm: 1000, ascender: 800, descender: -200 }
        } as never);

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
            lineBaseline,
        };

        placer.placeRunsForLine([{ item, offset: 0 }], lineContext);

        const runs = placer.getNodeRuns().get(node);
        expect(runs).toBeDefined();
        expect(runs!.length).toBe(1);

        // Baseline should match the shared lineBaseline = 100 + 0 + 16 = 116
        expect(runs![0].baseline).toBe(116);
    });

    it("uses shared lineBaseline even without FontEmbedder", () => {
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

        // Pre-compute the line baseline using default heuristic (no font metrics)
        const lineBaseline = calculateBaseline(100, 20, 20, null);

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
            lineBaseline,
        };

        placer.placeRunsForLine([{ item, offset: 0 }], lineContext);

        const runs = placer.getNodeRuns().get(node);
        expect(runs).toBeDefined();

        // Default heuristic baseline = 100 + 0 + (20*0.75) = 115
        expect(runs![0].baseline).toBe(115);
    });
});
