import { renderRuns } from "../helpers/render-utils.js";

function countLinesWithText(runs: Awaited<ReturnType<typeof renderRuns>>): number {
    const lines = new Set<number>();
    for (const run of runs) {
        if (typeof run.lineIndex !== "number") {
            continue;
        }
        if (run.text.trim().length === 0) {
            continue;
        }
        lines.add(run.lineIndex);
    }
    return lines.size;
}

function firstContentRunX(runs: Awaited<ReturnType<typeof renderRuns>>): number {
    let minX = Number.POSITIVE_INFINITY;
    for (const run of runs) {
        if (run.text.trim().length === 0) {
            continue;
        }
        const x = run.lineMatrix?.e ?? Number.POSITIVE_INFINITY;
        minX = Math.min(minX, x);
    }
    return minX;
}

describe("paged body margin behavior", () => {
    it("packs justified lines wider when pagedBodyMargin is zero", async () => {
        const html = `
      <p style="text-align: justify; font-family: 'Times New Roman', Times, serif;">
        This short sample demonstrates how justified paragraphs spread the remaining space
        across each line. When rendered as PDF the left and right edges are aligned,
        creating a tidy block of text similar to browsers.
      </p>
    `;

        const baseOptions = {
            viewportWidth: 698,
            viewportHeight: 1026,
            pageWidth: 794,
            pageHeight: 1123,
            margins: { top: 48, right: 48, bottom: 48, left: 48 },
        } as const;

        const autoRuns = await renderRuns(html, "", {
            ...baseOptions,
            pagedBodyMargin: "auto",
        });
        const zeroRuns = await renderRuns(html, "", {
            ...baseOptions,
            pagedBodyMargin: "zero",
        });

        expect(countLinesWithText(autoRuns)).toBeGreaterThan(countLinesWithText(zeroRuns));
    });

    it("honors explicit render margins when computing text start positions", async () => {
        const html = `<p>Margin probe text for verifying left offset changes across render options.</p>`;
        const common = {
            viewportWidth: 698,
            viewportHeight: 1026,
            pageWidth: 794,
            pageHeight: 1123,
            pagedBodyMargin: "zero" as const,
        };

        const narrowMarginRuns = await renderRuns(html, "", {
            ...common,
            margins: { top: 48, right: 40, bottom: 48, left: 40 },
        });
        const wideMarginRuns = await renderRuns(html, "", {
            ...common,
            margins: { top: 48, right: 40, bottom: 48, left: 120 },
        });

        const narrowX = firstContentRunX(narrowMarginRuns);
        const wideX = firstContentRunX(wideMarginRuns);

        expect(wideX).toBeGreaterThan(narrowX);
        expect(wideX - narrowX).toBeGreaterThan(60);
    });

    it("collapses whitespace-only runs between block siblings by default, with preserve escape hatch", async () => {
        const html = `
      <p>First paragraph.</p>

      <p>Second paragraph.</p>
    `;

        const collapsedRuns = await renderRuns(html, "", {
            pagedBodyMargin: "zero",
            interBlockWhitespace: "collapse",
        });
        const preservedRuns = await renderRuns(html, "", {
            pagedBodyMargin: "zero",
            interBlockWhitespace: "preserve",
        });

        const collapsedWhitespaceOnly = collapsedRuns.filter((r) => r.text.trim().length === 0);
        const preservedWhitespaceOnly = preservedRuns.filter((r) => r.text.trim().length === 0);

        expect(collapsedWhitespaceOnly.length).toBeLessThan(preservedWhitespaceOnly.length);
    });
});
