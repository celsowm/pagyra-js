import type { RenderBox, Run } from "../../src/pdf/types.js";

export interface LineMetrics {
    lineIndex: number;
    runs: Run[];
    xStart: number;
    xEnd: number;
}

/**
 * Group runs by lineIndex and compute xStart/xEnd using lineMatrix.e + advanceWidth.
 */
export function computeLineMetrics(box: RenderBox): LineMetrics[] {
    const runs = collectRuns(box).filter(
        (run) => typeof run.lineIndex === "number",
    );

    const byLine = new Map<number, Run[]>();

    for (const run of runs) {
        const idx = run.lineIndex as number;
        const list = byLine.get(idx);
        if (list) list.push(run);
        else byLine.set(idx, [run]);
    }

    const lines: LineMetrics[] = [];

    for (const [lineIndex, lineRuns] of byLine.entries()) {
        lineRuns.sort(
            (a, b) => (a.lineMatrix?.e ?? 0) - (b.lineMatrix?.e ?? 0),
        );

        const xStart = Math.min(...lineRuns.map((r) => r.lineMatrix?.e ?? 0));
        const xEnd = Math.max(
            ...lineRuns.map((r) => {
                const x = r.lineMatrix?.e ?? 0;
                const width = r.advanceWidth ?? 0;
                return x + width;
            }),
        );

        lines.push({ lineIndex, runs: lineRuns, xStart, xEnd });
    }

    lines.sort((a, b) => a.lineIndex - b.lineIndex);
    return lines;
}

function collectRuns(box: RenderBox): Run[] {
    const runs: Run[] = [...(box.textRuns ?? [])];
    for (const child of box.children) {
        runs.push(...collectRuns(child));
    }
    return runs;
}
