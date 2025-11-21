import type { FontMetrics, FontProgram } from "../../fonts/types.js";
import { createToUnicodeCMapText } from "./embedder.js";

/**
 * Represents a subsetted font ready for PDF embedding.
 */
export interface PdfFontSubset {
    name: string;
    firstChar: number;
    lastChar: number;
    widths: number[];
    toUnicodeCMap: string;
    fontFile: Uint8Array;
    encodeGlyph(gid: number): number;
    /**
     * Ordered glyph IDs included in this subset. The position in this array matches
     * the width entries when using identity encoding.
     */
    glyphIds: number[];
}

/**
 * Options for creating a PDF font subset.
 */
export interface PdfFontSubsetOptions {
    baseName: string;
    fontMetrics: FontMetrics;
    fontProgram: FontProgram;
    usedGlyphIds: Set<number>;
    /**
     * Controls how glyph IDs are mapped to PDF character codes.
     * - "identity" keeps CIDs = glyph IDs (suitable for CIDToGIDMap /Identity).
     * - "sequential" densely re-encodes glyphs starting at 0.
     */
    encoding?: "identity" | "sequential";
}

/**
 * Creates a PDF font subset for TTF fonts.
 */
export function createPdfFontSubset(options: PdfFontSubsetOptions): PdfFontSubset {
    const { baseName, fontMetrics, fontProgram, usedGlyphIds } = options;
    const encoding = options.encoding ?? "identity";

    const glyphIds = Array.from(usedGlyphIds).sort((a, b) => a - b);
    if (!glyphIds.includes(0)) {
        glyphIds.unshift(0);
    }

    const gidToCharCode = new Map<number, number>();

    if (encoding === "identity") {
        for (const gid of glyphIds) {
            gidToCharCode.set(gid, gid);
        }
    } else {
        for (let i = 0; i < glyphIds.length; i++) {
            gidToCharCode.set(glyphIds[i], i);
        }
    }

    const firstChar = encoding === "identity" ? Math.min(...glyphIds) : 0;
    const lastChar = encoding === "identity" ? Math.max(...glyphIds) : glyphIds.length - 1;

    const unitsPerEm = fontMetrics.metrics.unitsPerEm;
    const widths: number[] = [];
    if (encoding === "identity") {
        for (const gid of glyphIds) {
            const glyphMetric = fontMetrics.glyphMetrics.get(gid);
            const advanceWidth = glyphMetric?.advanceWidth ?? 0;
            const pdfWidth = Math.round((advanceWidth / unitsPerEm) * 1000);
            widths.push(pdfWidth);
        }
    } else {
        for (const gid of glyphIds) {
            const glyphMetric = fontMetrics.glyphMetrics.get(gid);
            const advanceWidth = glyphMetric?.advanceWidth ?? 0;
            const pdfWidth = Math.round((advanceWidth / unitsPerEm) * 1000);
            widths.push(pdfWidth);
        }
    }

    const cmapEntries: { gid: number; unicode: number }[] = [];
    const unicodeMap = fontMetrics.cmap.unicodeMap;

    for (const gid of glyphIds) {
        let unicode: number | undefined;
        for (const [cp, mappedGid] of unicodeMap.entries()) {
            if (mappedGid === gid) {
                unicode = cp;
                break;
            }
        }
        if (unicode !== undefined) {
            const cid = gidToCharCode.get(gid);
            if (cid !== undefined) {
                cmapEntries.push({ gid: cid, unicode });
            }
        }
    }

    const toUnicodeCMap = createToUnicodeCMapText(cmapEntries);
    const fontFile = extractFontFile(fontProgram);

    const encodeGlyph = (gid: number): number => {
        const charCode = gidToCharCode.get(gid);
        if (charCode === undefined) {
            throw new Error(`Glyph ID ${gid} not found in subset`);
        }
        return charCode;
    };

    return {
        name: `/${baseName}`,
        firstChar,
        lastChar,
        widths,
        toUnicodeCMap,
        fontFile,
        encodeGlyph,
        glyphIds,
    };
}

/**
 * Extracts the font file from FontProgram.
 * Builds a complete TTF with all available tables.
 */
function extractFontFile(fontProgram: FontProgram): Uint8Array {
    if (fontProgram.getRawTableData) {
        return buildTtfFromTables(fontProgram);
    }

    console.warn("Font subsetting not fully implemented; no raw table data available");
    return new Uint8Array(0);
}

/**
 * Builds a complete TTF file from available tables in FontProgram.
 */
function buildTtfFromTables(fontProgram: FontProgram): Uint8Array {
    const tableTags = [
        'head', 'hhea', 'maxp', 'OS/2', 'hmtx', 'cmap',
        'loca', 'glyf', 'name', 'post', 'cvt ', 'fpgm', 'prep'
    ];

    const tables: Map<string, Uint8Array> = new Map();

    for (const tag of tableTags) {
        const data = fontProgram.getRawTableData!(tag);
        if (data && data.length > 0) {
            tables.set(tag, data);
        }
    }

    if (tables.size === 0) {
        console.warn("No TTF tables available for font subsetting");
        return new Uint8Array(0);
    }

    const numTables = tables.size;
    const searchRange = Math.pow(2, Math.floor(Math.log2(numTables))) * 16;
    const entrySelector = Math.floor(Math.log2(numTables));
    const rangeShift = numTables * 16 - searchRange;

    const headerSize = 12;
    const directorySize = numTables * 16;
    let dataSize = 0;
    for (const data of tables.values()) {
        dataSize += data.length + (4 - (data.length % 4)) % 4;
    }

    const totalSize = headerSize + directorySize + dataSize;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    view.setUint32(0, 0x00010000, false);
    view.setUint16(4, numTables, false);
    view.setUint16(6, searchRange, false);
    view.setUint16(8, entrySelector, false);
    view.setUint16(10, rangeShift, false);

    let directoryOffset = 12;
    let dataOffset = headerSize + directorySize;

    for (const [tag, data] of tables) {
        const tagBytes = new TextEncoder().encode(tag.padEnd(4));
        bytes.set(tagBytes.slice(0, 4), directoryOffset);

        const checksum = calculateTableChecksum(data);
        view.setUint32(directoryOffset + 4, checksum, false);
        view.setUint32(directoryOffset + 8, dataOffset, false);
        view.setUint32(directoryOffset + 12, data.length, false);

        bytes.set(data, dataOffset);

        const paddedLength = data.length + (4 - (data.length % 4)) % 4;

        directoryOffset += 16;
        dataOffset += paddedLength;
    }

    updateHeadChecksum(bytes, view, tables);

    return bytes;
}

/**
 * Calculate TTF table checksum
 */
function calculateTableChecksum(data: Uint8Array): number {
    let sum = 0;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const nLongs = Math.floor(data.length / 4);

    for (let i = 0; i < nLongs; i++) {
        sum = (sum + view.getUint32(i * 4, false)) >>> 0;
    }

    const remaining = data.length % 4;
    if (remaining > 0) {
        let last = 0;
        for (let i = 0; i < remaining; i++) {
            last = (last << 8) | data[nLongs * 4 + i];
        }
        last = last << ((4 - remaining) * 8);
        sum = (sum + last) >>> 0;
    }

    return sum >>> 0;
}

/**
 * Update the checkSumAdjustment field in the head table
 */
function updateHeadChecksum(bytes: Uint8Array, view: DataView, tables: Map<string, Uint8Array>): void {
    const numTables = tables.size;
    let headOffset = -1;

    for (let i = 0; i < numTables; i++) {
        const dirOffset = 12 + i * 16;
        const tag = new TextDecoder().decode(bytes.slice(dirOffset, dirOffset + 4));
        if (tag.trim() === 'head') {
            headOffset = view.getUint32(dirOffset + 8, false);
            break;
        }
    }

    if (headOffset === -1) return;

    view.setUint32(headOffset + 8, 0, false);

    const fileChecksum = calculateTableChecksum(bytes);

    const adjustment = (0xB1B0AFBA - fileChecksum) >>> 0;
    view.setUint32(headOffset + 8, adjustment, false);
}
