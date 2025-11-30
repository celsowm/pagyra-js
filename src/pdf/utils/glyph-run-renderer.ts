import type { GlyphRun } from "../../layout/text-run.js";
import type { PdfFontSubset } from "../font/font-subset.js";
import type { GraphicsStateManager } from "../renderers/graphics-state-manager.js";
import { fillColorCommand, formatNumber } from "../renderers/text-renderer-utils.js";
import type { RGBA } from "../types.js";

export interface DrawGlyphRunOptions {
  skipColor?: boolean;
  textRenderingMode?: number;
  afterTextCommands?: string[];
}

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
  color: RGBA,
  graphicsStateManager?: GraphicsStateManager,
  wordSpacingPt = 0,
  options?: DrawGlyphRunOptions,
): string[] {
    const commands: string[] = [];
    if (!options?.skipColor) {
      commands.push(fillColorCommand(color, graphicsStateManager));
    }

    // Begin text
    commands.push("BT");
    commands.push(`${subset.name} ${formatNumber(fontSizePt)} Tf`);
    commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} Td`);

    const appliedWordSpacing = wordSpacingPt !== 0;
    if (appliedWordSpacing) {
      commands.push(`${formatNumber(wordSpacingPt)} Tw`);
    }

    if (options?.textRenderingMode !== undefined) {
      commands.push(`${options.textRenderingMode} Tr`);
    }

    // Build TJ array with per-glyph kerning/letter-spacing adjustments and optional word spacing.
    // Positions are provided in layout px units; scale to PDF points.
    const ptPerPx = fontSizePt / run.fontSize;
    const unitsPerEm = run.font.metrics.metrics.unitsPerEm;
    const glyphWidths = run.font.metrics.glyphMetrics;
    const encodeGlyphId = (gid: number): string => {
        const charCode = subset.encodeGlyph(gid);
        const hex = charCode.toString(16).toUpperCase();
        // PDF expects an even number of hex digits; use at least 2 bytes for Identity-H
        const evenHex = hex.length % 2 === 0 ? hex : `0${hex}`;
        return evenHex.length < 4 ? evenHex.padStart(4, "0") : evenHex;
    };
    const elements: (string | number)[] = [];
    let hasAdjustments = false;

    for (let i = 0; i < run.glyphIds.length; i++) {
        const gid = run.glyphIds[i];
        const hexCode = encodeGlyphId(gid);
        elements.push(`<${hexCode}>`);

        if (i < run.glyphIds.length - 1) {
            const currentPos = run.positions[i]?.x ?? 0;
            const nextPos = run.positions[i + 1]?.x ?? currentPos;
            let desiredAdvancePx = nextPos - currentPos;
            if (appliedWordSpacing) {
                const nextChar = run.text[i + 1] ?? "";
                if (nextChar === " ") {
                    // Word spacing is added on spaces; add to desired advance.
                    desiredAdvancePx += wordSpacingPt / ptPerPx;
                }
            }

            const gm = glyphWidths.get(gid);
            const defaultAdvancePx = ((gm?.advanceWidth ?? 0) / unitsPerEm) * run.fontSize;

            const deltaPx = desiredAdvancePx - defaultAdvancePx;
            if (Math.abs(deltaPx) > 1e-6) {
                const deltaPt = deltaPx * ptPerPx;
                // TJ numbers are in thousandths of text space; positive numbers tighten spacing.
                const adjustment = -deltaPt / fontSizePt * 1000;
                if (Math.abs(adjustment) > 1e-6) {
                    hasAdjustments = true;
                    elements.push(adjustment);
                }
            }
        }
    }

    if (!hasAdjustments) {
        // Use a single hex string when there are no per-glyph adjustments; simpler and more compatible.
        const hex = run.glyphIds.map((gid) => encodeGlyphId(gid)).join("");
        commands.push(`<${hex}> Tj`);
    } else {
        const tjContent = elements
            .map((el) => (typeof el === "number" ? formatPdfNumber(el) : el))
            .join(" ");
        commands.push(`[${tjContent}] TJ`);
    }

    // End text
    commands.push("ET");
    if (options?.afterTextCommands && options.afterTextCommands.length > 0) {
        commands.push(...options.afterTextCommands);
    }

    return commands;
}

/**
 * Format a number for PDF (up to 6 decimal places, trailing zeros removed).
 */
export function formatPdfNumber(n: number): string {
    return n.toFixed(6).replace(/\.?0+$/, "");
}
