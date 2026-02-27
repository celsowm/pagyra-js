import type { RenderBox, Run } from "../types.js";

/**
 * Global pass to fix justified layout in the render tree.
 *
 * For each RenderBox with textAlign: "justify":
 *   - collect ALL runs from that box and its descendants
 *   - group runs by lineIndex
 *   - sort each group by lineMatrix.e (X)
 *   -for each non-final line:
 *       * shift later runs by the cumulative expansion
 *         from previous runs: spacesInRun * wordSpacing
 */
export function applyTextLayoutAdjustments(root: RenderBox): void {
    traverse(root, (box) => {
        // Only process boxes with justify alignment
        if (box.textAlign !== "justify") return true; // Continue searching

        // Collect ALL runs from this box and its descendants
        const allRuns: Run[] = [];
        collectRunsFromTree(box, allRuns);

        const candidates = allRuns.filter(
            (run) => typeof run.lineIndex === "number",
        );
        if (candidates.length === 0) return false; // Stop descending

        const groups = groupRunsByLineIndex(candidates);
        for (const lineRuns of groups) {
            adjustLinePositions(lineRuns);
        }

        return false; // Stop descending into this justified box
    });
}

function groupRunsByLineIndex(runs: Run[]): Run[][] {
    const map = new Map<number, Run[]>();

    for (const run of runs) {
        const idx = run.lineIndex as number;
        let group = map.get(idx);
        if (!group) {
            group = [];
            map.set(idx, group);
        }
        group.push(run);
    }

    for (const group of map.values()) {
        group.sort((a, b) => {
            const ax = a.lineMatrix?.e ?? 0;
            const bx = b.lineMatrix?.e ?? 0;
            return ax - bx;
        });
    }

    return Array.from(map.values());
}

/**
 * Adjust positions on a single visual line.
 *
 * - Skip last lines (isLastLine === true).
 * - Skip lines with no spaces.
 * - Walk from left to right:
 *    * shift run.x by cumulativeOffset
 *    * cumulativeOffset += spacesInRun * wordSpacing
 */
function adjustLinePositions(runs: Run[]): void {
    if (runs.length === 0) return;

    // Find first non-whitespace run to identify leading spaces
    let firstContentIndex = 0;
    while (
        firstContentIndex < runs.length &&
        /^\s+$/.test(runs[firstContentIndex].text)
    ) {
        firstContentIndex++;
    }
    const hasLeadingWhitespace = firstContentIndex > 0;

    if (firstContentIndex >= runs.length) {
        const anchorX = runs[0].lineMatrix?.e ?? 0;
        for (const run of runs) {
            if (run.lineMatrix) {
                run.lineMatrix.e = anchorX;
            }
            run.advanceWidth = 0;
        }
        return;
    }

    // Calculate width to redistribute from leading spaces
    let widthLost = 0;
    for (let i = 0; i < firstContentIndex; i++) {
        widthLost += runs[i].advanceWidth ?? 0;
    }

    // Count remaining spaces
    let remainingSpaces = 0;
    for (let i = firstContentIndex; i < runs.length; i++) {
        remainingSpaces += runs[i].spacesInRun ?? 0;
    }

    const isLastLine = runs[0].isLastLine ?? false;

    // Redistribute width if not last line and we have spaces to distribute to
    if (hasLeadingWhitespace && !isLastLine && widthLost > 0 && remainingSpaces > 0) {
        const adjustment = widthLost / remainingSpaces;
        for (let i = firstContentIndex; i < runs.length; i++) {
            const run = runs[i];
            if ((run.spacesInRun ?? 0) > 0) {
                run.wordSpacing = (run.wordSpacing ?? 0) + adjustment;
                // Update advanceWidth to reflect the new spacing
                run.advanceWidth =
                    (run.advanceWidth ?? 0) + (run.spacesInRun! * adjustment);
            }
        }
    }

    // Capture original positions and base widths to detect existing gaps
    const originals = runs.map((run) => ({
        x: run.lineMatrix?.e ?? 0,
        baseWidth:
            (run.advanceWidth ?? 0) -
            (run.spacesInRun ?? 0) * (run.wordSpacing ?? 0),
        fontSize: run.fontSize,
    }));

    let currentX = originals[0].x;

    for (let i = 0; i < runs.length; i++) {
        const run = runs[i];

        // If it's a leading whitespace run, treat as zero width and skip
        if (i < firstContentIndex) {
            if (run.lineMatrix) {
                run.lineMatrix.e = currentX;
            }
            // Set width to 0 to avoid overlaps in tests and rendering
            run.advanceWidth = 0;
            continue;
        }

        if (run.lineMatrix) {
            run.lineMatrix.e = currentX;
        }

        const advanceWidth = run.advanceWidth ?? 0;
        currentX += advanceWidth;

        // If there's a significant gap between this run and the next (e.g. an image), preserve it.
        // Otherwise, assume it's a text gap/overlap and close it (using our calculated advanceWidth).
        if (i < runs.length - 1) {
            const nextOriginal = originals[i + 1];
            const currOriginal = originals[i];

            const gap = nextOriginal.x - (currOriginal.x + currOriginal.baseWidth);
            // Use the larger font size as a threshold for "is this a text gap?"
            const threshold = Math.max(currOriginal.fontSize, nextOriginal.fontSize);

            // Preserve gap if it's large, OR if the current run has 0 width (and wasn't stripped)
            // This handles cases where layout engine produced 0-width runs but placed them with spacing.
            const isStripped = i < firstContentIndex;
            if (gap > threshold || (!isStripped && advanceWidth === 0 && gap > 0)) {
                currentX += gap;
            }
        }
    }
}

function collectRunsFromTree(box: RenderBox, accumulator: Run[]): void {
    if (box.textRuns) {
        accumulator.push(...box.textRuns);
    }
    for (const child of box.children) {
        collectRunsFromTree(child, accumulator);
    }
}

function traverse(box: RenderBox, visitor: (box: RenderBox) => boolean): void {
    const continueTraversal = visitor(box);
    if (continueTraversal) {
        for (const child of box.children) {
            traverse(child, visitor);
        }
    }
}
