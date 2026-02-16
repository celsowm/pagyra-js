
import type { FontMetrics, FontProgram } from "../../fonts/types.js";
import { createToUnicodeCMapText } from "./to-unicode.js";
import { BinaryWriter } from "./binary-writer.js";
import { LocaTableReader } from "./loca-reader.js";
import { DefaultDataViewReader } from "./ttf-table-provider.js";

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
     * Ordered glyph IDs included in this subset.
     */
    glyphIds: number[];
    /**
     * Map from original GID to new subset GID.
     */
    gidMap: Map<number, number>;
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
     * - "identity" keeps CIDs = Original Glyph IDs (most stable for progressive rendering).
     * - "sequential" densely re-encodes glyphs starting at 0 (most compact).
     */
    encoding?: "identity" | "sequential";
}

/**
 * Creates a PDF font subset for TTF fonts.
 */
export function createPdfFontSubset(options: PdfFontSubsetOptions): PdfFontSubset {
    const { baseName, fontMetrics, fontProgram, usedGlyphIds } = options;
    const encoding = options.encoding ?? "identity";

    // 1. Compute closure of used glyphs (checking composite glyphs)
    const initialGids = Array.from(usedGlyphIds);
    if (!initialGids.includes(0)) {
        initialGids.push(0); // Always include .notdef
    }

    const { glyphIds, gidMap } = computeSubsetClosure(fontProgram, initialGids);

    const unitsPerEm = fontMetrics.metrics.unitsPerEm;
    const widths: number[] = [];
    const usedGidSet = new Set(glyphIds);

    let firstChar: number;
    let lastChar: number;

    if (encoding === "sequential") {
        firstChar = 0;
        lastChar = glyphIds.length - 1;
        for (const gid of glyphIds) {
            const glyphMetric = fontMetrics.glyphMetrics.get(gid);
            const advanceWidth = glyphMetric?.advanceWidth ?? 0;
            widths.push(Math.round((advanceWidth / unitsPerEm) * 1000));
        }
    } else {
        // Identity: CIDs = Original GIDs.
        // We use a sparse range from 0 to maxGid to ensure stability.
        const maxGid = Math.max(...glyphIds);
        firstChar = 0;
        lastChar = maxGid;
        for (let i = 0; i <= maxGid; i++) {
            const glyphMetric = fontMetrics.glyphMetrics.get(i);
            const advanceWidth = glyphMetric?.advanceWidth ?? 0;
            widths.push(Math.round((advanceWidth / unitsPerEm) * 1000));
        }
    }

    // Generate ToUnicode CMap
    // we map CID -> Unicode.
    const cmapEntries: { gid: number; unicode: number }[] = [];
    const unicodeMap = fontMetrics.cmap.unicodeMap;

    const gidToUnicodes = new Map<number, number[]>();
    for (const [cp, mappedGid] of unicodeMap.entries()) {
        const list = gidToUnicodes.get(mappedGid) || [];
        list.push(cp);
        gidToUnicodes.set(mappedGid, list);
    }

    if (encoding === "sequential") {
        for (let i = 0; i < glyphIds.length; i++) {
            const originalGid = glyphIds[i];
            const unicodes = gidToUnicodes.get(originalGid);
            if (unicodes) {
                for (const u of unicodes) {
                    cmapEntries.push({ gid: i, unicode: u });
                }
            }
        }
    } else {
        // Identity: CID = Original GID
        for (const gid of glyphIds) {
            const unicodes = gidToUnicodes.get(gid);
            if (unicodes) {
                for (const u of unicodes) {
                    cmapEntries.push({ gid: gid, unicode: u });
                }
            }
        }
    }

    const toUnicodeCMap = createToUnicodeCMapText(cmapEntries);

    // Generate the binary TTF
    const fontFile = subsetFont(fontProgram, glyphIds, encoding);

    const encodeGlyph = (gid: number): number => {
        if (encoding === "sequential") {
            const index = gidMap.get(gid);
            if (index === undefined) throw new Error(`Glyph ID ${gid} not found in subset`);
            return index;
        } else {
            return gid;
        }
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
        gidMap
    };
}

function computeSubsetClosure(fontProgram: FontProgram, initialGids: number[]): { glyphIds: number[], gidMap: Map<number, number> } {
    const reader = new DefaultDataViewReader();
    const glyfData = fontProgram.getRawTableData?.("glyf");
    const locaData = fontProgram.getRawTableData?.("loca");
    const headData = fontProgram.getRawTableData?.("head");

    const used = new Set<number>(initialGids);
    const stack = [...initialGids];

    if (!glyfData || !locaData || !headData) {
        const sorted = Array.from(used).sort((a, b) => a - b);
        const map = new Map<number, number>();
        sorted.forEach((gid, i) => map.set(gid, i));
        return { glyphIds: sorted, gidMap: map };
    }

    const headView = new DataView(headData.buffer, headData.byteOffset, headData.byteLength);
    const locaView = new DataView(locaData.buffer, locaData.byteOffset, locaData.byteLength);
    const glyfView = new DataView(glyfData.buffer, glyfData.byteOffset, glyfData.byteLength);

    const indexToLocFormat = reader.getUint16(headView, 50);
    const locaReader = new LocaTableReader(locaView, indexToLocFormat, reader);

    while (stack.length > 0) {
        const gid = stack.pop()!;
        const offset = locaReader.getGlyphOffset(gid);
        if (!offset || offset.start === offset.end) continue;

        if (offset.start + 2 > glyfView.byteLength) continue;
        const numberOfContours = reader.getInt16(glyfView, offset.start);

        if (numberOfContours < 0) {
            let pos = offset.start + 10;
            let flags: number;
            do {
                if (pos + 4 > glyfView.byteLength) break;
                flags = reader.getUint16(glyfView, pos);
                const componentGid = reader.getUint16(glyfView, pos + 2);

                if (!used.has(componentGid)) {
                    used.add(componentGid);
                    stack.push(componentGid);
                }

                pos += 4;
                const arg1And2AreWords = (flags & 0x0001) !== 0;
                if (arg1And2AreWords) pos += 4; else pos += 2;
                const weHaveAScale = (flags & 0x0008) !== 0;
                const weHaveAnXAndYScale = (flags & 0x0040) !== 0;
                const weHaveATwoByTwo = (flags & 0x0080) !== 0;
                if (weHaveAScale) pos += 2;
                else if (weHaveAnXAndYScale) pos += 4;
                else if (weHaveATwoByTwo) pos += 8;
            } while (flags & 0x0020);
        }
    }

    const sorted = Array.from(used).sort((a, b) => a - b);
    const map = new Map<number, number>();
    sorted.forEach((gid, i) => map.set(gid, i));

    return { glyphIds: sorted, gidMap: map };
}

function subsetFont(fontProgram: FontProgram, glyphIds: number[], encoding: "identity" | "sequential"): Uint8Array {
    const reader = new DefaultDataViewReader();
    const getTable = (tag: string) => fontProgram.getRawTableData?.(tag);

    const head = getTable("head");
    const hhea = getTable("hhea");
    const maxp = getTable("maxp");
    const hmtx = getTable("hmtx");
    const loca = getTable("loca");
    const glyf = getTable("glyf");
    const OS2 = getTable("OS/2");

    if (!head || !hhea || !maxp || !hmtx || !loca || !glyf) {
        throw new Error("Missing required tables for subsetting");
    }

    const headView = new DataView(head.buffer, head.byteOffset, head.byteLength);
    const locaView = new DataView(loca.buffer, loca.byteOffset, loca.byteLength);
    const glyfView = new DataView(glyf.buffer, glyf.byteOffset, glyf.byteLength);
    const hmtxView = new DataView(hmtx.buffer, hmtx.byteOffset, hmtx.byteLength);
    const hheaView = new DataView(hhea.buffer, hhea.byteOffset, hhea.byteLength);

    const indexToLocFormat = reader.getUint16(headView, 50);
    const locaReader = new LocaTableReader(locaView, indexToLocFormat, reader);
    const numberOfHMetrics = reader.getUint16(hheaView, 34);

    const newLoca = new BinaryWriter();
    const newGlyf = new BinaryWriter();
    const usedGidSet = new Set(glyphIds);

    let maxGidToEmit: number;
    if (encoding === "sequential") {
        maxGidToEmit = glyphIds.length - 1;
        const gidMap = new Map<number, number>();
        glyphIds.forEach((gid, i) => gidMap.set(gid, i));

        for (const originalGid of glyphIds) {
            newLoca.writeUint32(newGlyf.byteLength());
            const range = locaReader.getGlyphOffset(originalGid);
            if (range && range.end > range.start) {
                const glyphData = new Uint8Array(glyf.buffer, glyf.byteOffset + range.start, range.end - range.start);
                const numberOfContours = reader.getInt16(new DataView(glyphData.buffer, glyphData.byteOffset, glyphData.byteLength), 0);
                if (numberOfContours < 0) {
                    const newGlyphData = new Uint8Array(glyphData);
                    const view = new DataView(newGlyphData.buffer);
                    let pos = 10;
                    let flags: number;
                    do {
                        flags = reader.getUint16(view, pos);
                        const oldCompGid = reader.getUint16(view, pos + 2);
                        view.setUint16(pos + 2, gidMap.get(oldCompGid) ?? 0, false);
                        pos += 4;
                        const arg1And2AreWords = (flags & 0x0001) !== 0;
                        if (arg1And2AreWords) pos += 4; else pos += 2;
                        const weHaveAScale = (flags & 0x0008) !== 0;
                        const weHaveAnXAndYScale = (flags & 0x0040) !== 0;
                        const weHaveATwoByTwo = (flags & 0x0080) !== 0;
                        if (weHaveAScale) pos += 2;
                        else if (weHaveAnXAndYScale) pos += 4;
                        else if (weHaveATwoByTwo) pos += 8;
                    } while (flags & 0x0020);
                    newGlyf.writeBytes(newGlyphData);
                } else {
                    newGlyf.writeBytes(glyphData);
                }
            }
        }
    } else {
        // Identity Mode: Sparse TTF
        maxGidToEmit = Math.max(...glyphIds);
        for (let gid = 0; gid <= maxGidToEmit; gid++) {
            newLoca.writeUint32(newGlyf.byteLength());
            if (usedGidSet.has(gid)) {
                const range = locaReader.getGlyphOffset(gid);
                if (range && range.end > range.start) {
                    const glyphData = new Uint8Array(glyf.buffer, glyf.byteOffset + range.start, range.end - range.start);
                    newGlyf.writeBytes(glyphData);
                }
            }
        }
    }
    newLoca.writeUint32(newGlyf.byteLength());

    // 2. MAXP
    const maxpLength = maxp.byteLength > 6 ? 6 + Math.min(maxp.byteLength - 6, 26) : maxp.byteLength;
    const newMaxpBytes = new Uint8Array(maxpLength);
    newMaxpBytes.set(new Uint8Array(maxp.buffer, maxp.byteOffset, maxpLength));
    const maxpView = new DataView(newMaxpBytes.buffer, newMaxpBytes.byteOffset, newMaxpBytes.byteLength);
    maxpView.setUint16(4, maxGidToEmit + 1, false);

    // 3. HMTX
    const newHmtx = new BinaryWriter();
    if (encoding === "sequential") {
        for (const originalGid of glyphIds) {
            let advance = 0, lsb = 0;
            if (originalGid < numberOfHMetrics) {
                advance = reader.getUint16(hmtxView, originalGid * 4);
                lsb = reader.getInt16(hmtxView, originalGid * 4 + 2);
            } else {
                advance = reader.getUint16(hmtxView, (numberOfHMetrics - 1) * 4);
                const lsbOffset = numberOfHMetrics * 4 + (originalGid - numberOfHMetrics) * 2;
                if (lsbOffset + 2 <= hmtxView.byteLength) lsb = reader.getInt16(hmtxView, lsbOffset);
            }
            newHmtx.writeUint16(advance);
            newHmtx.writeInt16(lsb);
        }
    } else {
        for (let gid = 0; gid <= maxGidToEmit; gid++) {
            let advance = 0, lsb = 0;
            if (gid < numberOfHMetrics) {
                advance = reader.getUint16(hmtxView, gid * 4);
                lsb = reader.getInt16(hmtxView, gid * 4 + 2);
            } else {
                advance = reader.getUint16(hmtxView, (numberOfHMetrics - 1) * 4);
                const lsbOffset = numberOfHMetrics * 4 + (gid - numberOfHMetrics) * 2;
                if (lsbOffset + 2 <= hmtxView.byteLength) lsb = reader.getInt16(hmtxView, lsbOffset);
            }
            newHmtx.writeUint16(advance);
            newHmtx.writeInt16(lsb);
        }
    }

    // 4. HHEA
    const newHheaBytes = new Uint8Array(hhea.byteLength);
    newHheaBytes.set(new Uint8Array(hhea.buffer, hhea.byteOffset, hhea.byteLength));
    const newHheaView = new DataView(newHheaBytes.buffer, newHheaBytes.byteOffset, newHheaBytes.byteLength);
    newHheaView.setUint16(34, maxGidToEmit + 1, false);

    // 5. CMAP (Minimal Dummy)
    const newCmap = new BinaryWriter();
    newCmap.writeUint16(0);
    newCmap.writeUint16(1);
    newCmap.writeUint16(3);
    newCmap.writeUint16(1);
    newCmap.writeUint32(12);
    const startCmap = newCmap.byteLength();
    newCmap.writeUint16(4);
    newCmap.writeUint16(0);
    newCmap.writeUint16(0);
    newCmap.writeUint16(0);
    newCmap.writeUint16(0);
    newCmap.writeUint16(0);
    newCmap.writeUint16(0);
    newCmap.writeUint16(0xFFFF);
    newCmap.writeUint16(0);
    newCmap.writeUint16(0);
    newCmap.writeUint16(0);
    newCmap.writeUint16(0);
    const endCmap = newCmap.byteLength();
    const newCmapBytes = newCmap.getData();
    const cmapView = new DataView(newCmapBytes.buffer, newCmapBytes.byteOffset, newCmapBytes.byteLength);
    cmapView.setUint16(startCmap + 2, endCmap - startCmap, false);

    // 6. HEAD
    const newHeadBytes = new Uint8Array(head.byteLength);
    newHeadBytes.set(new Uint8Array(head.buffer, head.byteOffset, head.byteLength));
    const newHeadView = new DataView(newHeadBytes.buffer, newHeadBytes.byteOffset, newHeadBytes.byteLength);
    newHeadView.setUint16(50, 1, false);
    newHeadView.setUint32(8, 0, false);

    const tables: [string, Uint8Array][] = [
        ["head", newHeadBytes],
        ["hhea", newHheaBytes],
        ["maxp", newMaxpBytes],
        ["hmtx", newHmtx.getData()],
        ["loca", newLoca.getData()],
        ["glyf", newGlyf.getData()],
        ["cmap", newCmapBytes]
    ];
    if (OS2) tables.push(["OS/2", new Uint8Array(OS2)]);

    tables.sort((a, b) => a[0].localeCompare(b[0]));
    const numTables = tables.length;
    const searchRange = Math.pow(2, Math.floor(Math.log2(numTables))) * 16;
    const entrySelector = Math.floor(Math.log2(numTables));
    const rangeShift = numTables * 16 - searchRange;

    const fullTtf = new BinaryWriter();
    fullTtf.writeUint32(0x00010000);
    fullTtf.writeUint16(numTables);
    fullTtf.writeUint16(searchRange);
    fullTtf.writeUint16(entrySelector);
    fullTtf.writeUint16(rangeShift);

    let offset = 12 + numTables * 16;
    for (const [tag, data] of tables) {
        fullTtf.writeBytes(new TextEncoder().encode(tag.padEnd(4)).slice(0, 4));
        fullTtf.writeUint32(calculateChecksum(data));
        fullTtf.writeUint32(offset);
        fullTtf.writeUint32(data.length);
        let paddedLength = data.length;
        if (data.length % 4 !== 0) paddedLength += 4 - (data.length % 4);
        offset += paddedLength;
    }

    for (const [_, data] of tables) {
        fullTtf.writeBytes(data);
        const padding = (4 - (data.length % 4)) % 4;
        for (let k = 0; k < padding; k++) fullTtf.writeUint8(0);
    }

    const ttfBytes = fullTtf.getData();
    const ttfView = new DataView(ttfBytes.buffer, ttfBytes.byteOffset, ttfBytes.byteLength);
    const fileChecksum = calculateChecksum(ttfBytes);
    const adjustment = (0xB1B0AFBA - fileChecksum) >>> 0;

    let headOffset = 0;
    for (let i = 0; i < numTables; i++) {
        const tag = new TextDecoder().decode(ttfBytes.slice(12 + i * 16, 12 + i * 16 + 4));
        if (tag === "head") {
            headOffset = ttfView.getUint32(12 + i * 16 + 8, false);
            break;
        }
    }
    if (headOffset > 0) ttfView.setUint32(headOffset + 8, adjustment, false);

    return ttfBytes;
}

function calculateChecksum(data: Uint8Array): number {
    let sum = 0;
    const nLongs = Math.floor(data.length / 4);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let i = 0; i < nLongs; i++) sum = (sum + view.getUint32(i * 4, false)) >>> 0;
    const remaining = data.length % 4;
    if (remaining > 0) {
        let last = 0;
        for (let i = 0; i < remaining; i++) last = (last << 8) | data[nLongs * 4 + i];
        last = last << ((4 - remaining) * 8);
        sum = (sum + last) >>> 0;
    }
    return sum >>> 0;
}
