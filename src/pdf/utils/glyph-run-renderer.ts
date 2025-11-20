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

    // Encode glyphs as hex string
    const encodedGlyphs: string[] = [];
    for (const gid of run.glyphIds) {
        const charCode = subset.encodeGlyph(gid);
        // Convert to 2-byte hex (CID fonts use 16-bit char codes)
        const hexCode = charCode.toString(16).padStart(4, "0").toUpperCase();
        encodedGlyphs.push(hexCode);
    }

    // Emit as hex string
    const hexString = encodedGlyphs.join("");
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
