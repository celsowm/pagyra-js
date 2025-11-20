import type { GlyphRun } from "../../layout/text-run.js";
import type { PdfFontSubset } from "../font/font-subset.js";

/**
 * Draws a GlyphRun using a PdfFontSubset.
 * Returns PDF content stream commands.
 */
export function drawGlyphRun(
    run: GlyphRun,
    subset: PdfFontSubset,
    xPt: number,
    yPt: number,
    fontSizePt: number,
    color: { r: number; g: number; b: number; a: number }
): string[] {
    const commands: string[] = [];

    // Set fill color
    commands.push(`${color.r.toFixed(3)} ${color.g.toFixed(3)} ${color.b.toFixed(3)} rg`);

    // Begin text
    commands.push("BT");

    // Set font and size
    commands.push(`${subset.name} ${fontSizePt.toFixed(2)} Tf`);

    // Set text position
    commands.push(`${xPt.toFixed(2)} ${yPt.toFixed(2)} Td`);

    // For Identity-H encoding, we need to write Unicode code points, not glyph IDs
    // The font's internal cmap will map Unicode -> Glyph ID during rendering
    const encodedChars: string[] = [];
    for (let i = 0; i < run.text.length; i++) {
        const codePoint = run.text.codePointAt(i);
        if (codePoint === undefined) continue;

        // Convert Unicode code point to 2-byte hex (Identity-H uses 16-bit char codes)
        const hexCode = codePoint.toString(16).padStart(4, "0").toUpperCase();
        encodedChars.push(hexCode);

        // Skip next char if this was a surrogate pair
        if (codePoint > 0xFFFF) i++;
    }

    // Emit as hex string
    const hexString = encodedChars.join("");
    commands.push(`<${hexString}> Tj`);

    // End text
    commands.push("ET");

    return commands;
}

/**
 * Format a number for PDF (up to 6 decimal places, trailing zeros removed).
 */
export function formatPdfNumber(n: number): string {
    return n.toFixed(6).replace(/\.?0+$/, "");
}
