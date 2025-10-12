import { readFileSync } from "fs";
import { TtfFontMetrics } from "../../types/fonts.js";
// TTF table offsets in the file
const HEAD_TABLE_OFFSET = 4;
const HHEA_TABLE_OFFSET = 5;
const HMTX_TABLE_OFFSET = 6;
const CMAP_TABLE_OFFSET = 16;
const OS_2_TABLE_OFFSET = 11;
// Common TTF table tags
const HEAD = 0x68656164; // 'head'
const HHEA = 0x68686561; // 'hhea'
const HMTX = 0x686d7478; // 'hmtx'
const CMAP = 0x636d6170; // 'cmap'
const OS_2 = 0x4f532f32; // 'OS/2'
class TtfTableParser {
    dataView;
    tableDirectory = new Map();
    constructor(buffer) {
        this.dataView = new DataView(buffer);
        this.parseTableDirectory();
    }
    parseTableDirectory() {
        const numTables = this.dataView.getUint16(4, false); // big-endian
        const searchRange = this.dataView.getUint16(6, false);
        const tableDirOffset = 12;
        for (let i = 0; i < numTables; i++) {
            const offset = tableDirOffset + i * 16;
            const tag = this.dataView.getUint32(offset, false);
            const checksum = this.dataView.getUint32(offset + 4, false);
            const tableOffset = this.dataView.getUint32(offset + 8, false);
            const length = this.dataView.getUint32(offset + 12, false);
            this.tableDirectory.set(tag, {
                tag,
                checksum,
                offset: tableOffset,
                length
            });
        }
    }
    getTable(tag) {
        const entry = this.tableDirectory.get(tag);
        if (!entry)
            return null;
        return new DataView(this.dataView.buffer, entry.offset, entry.length);
    }
    getUint16(table, offset) {
        return table.getUint16(offset, false); // big-endian
    }
    getInt16(table, offset) {
        return table.getInt16(offset, false); // big-endian
    }
    getUint32(table, offset) {
        return table.getUint32(offset, false); // big-endian
    }
}
class CmapParser {
    unicodeMap = new Map();
    constructor(cmapTable) {
        this.parseCmapTable(cmapTable);
    }
    parseCmapTable(table) {
        const version = table.getUint16(0, false);
        if (version !== 0)
            return; // only support version 0
        const numSubtables = table.getUint16(2, false);
        // Find Unicode BMP (UCS-2) encoding
        for (let i = 0; i < numSubtables; i++) {
            const subtableOffset = 4 + i * 8;
            const platformId = table.getUint16(subtableOffset, false);
            const encodingId = table.getUint16(subtableOffset + 2, false);
            const subtableStart = table.getUint32(subtableOffset + 4, false);
            // Platform 3 = Windows, Encoding 1 = Unicode BMP (UCS-2)
            if (platformId === 3 && encodingId === 1) {
                this.parseFormat4Table(table, subtableStart);
                break;
            }
            // Platform 0 = Unicode, Encoding 3 = Unicode 2.0 or later
            else if (platformId === 0 && encodingId === 3) {
                this.parseFormat4Table(table, subtableStart);
                break;
            }
        }
    }
    parseFormat4Table(table, offset) {
        const format = table.getUint16(offset, false);
        if (format !== 4)
            return; // only support format 4
        const segCount = table.getUint16(offset + 6, false) / 2;
        const endCodeOffset = offset + 14;
        const startCodeOffset = endCodeOffset + segCount * 2 + 2;
        const idDeltaOffset = startCodeOffset + segCount * 2;
        const idRangeOffsetOffset = idDeltaOffset + segCount * 2;
        for (let i = 0; i < segCount; i++) {
            const endCode = table.getUint16(endCodeOffset + i * 2, false);
            const startCode = table.getUint16(startCodeOffset + i * 2, false);
            const idDelta = table.getUint16(idDeltaOffset + i * 2, false);
            const idRangeOffset = table.getUint16(idRangeOffsetOffset + i * 2, false);
            if (startCode === 0xFFFF)
                break;
            for (let code = startCode; code <= endCode; code++) {
                let glyphId;
                if (idRangeOffset === 0) {
                    glyphId = (code + idDelta) & 0xFFFF;
                }
                else {
                    const glyphIndexOffset = idRangeOffsetOffset + i * 2 + idRangeOffset + (code - startCode) * 2;
                    glyphId = table.getUint16(glyphIndexOffset, false);
                    if (glyphId !== 0) {
                        glyphId = (glyphId + idDelta) & 0xFFFF;
                    }
                }
                this.unicodeMap.set(code, glyphId);
            }
        }
    }
    getGlyphId(codePoint) {
        return this.unicodeMap.get(codePoint) ?? 0;
    }
    hasCodePoint(codePoint) {
        return this.unicodeMap.has(codePoint);
    }
}
export function parseTtfFont(filePath) {
    const buffer = readFileSync(filePath);
    const parser = new TtfTableParser(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
    try {
        // Parse head table for general metrics
        const headTable = parser.getTable(HEAD);
        if (!headTable)
            throw new Error('Missing head table');
        const unitsPerEm = parser.getUint16(headTable, 18);
        const indexToLocFormat = parser.getInt16(headTable, 50);
        // Parse hhea table for horizontal metrics
        const hheaTable = parser.getTable(HHEA);
        if (!hheaTable)
            throw new Error('Missing hhea table');
        const ascender = parser.getInt16(hheaTable, 4);
        const descender = parser.getInt16(hheaTable, 6);
        const lineGap = parser.getInt16(hheaTable, 8);
        const numOfLongHorMetrics = parser.getUint16(hheaTable, 34);
        // Parse OS/2 table for additional metrics
        const os2Table = parser.getTable(OS_2);
        let capHeight = ascender;
        let xHeight = ascender * 0.5;
        if (os2Table && os2Table.byteLength >= 96) {
            capHeight = parser.getInt16(os2Table, 88);
            xHeight = parser.getInt16(os2Table, 86);
        }
        const metrics = {
            unitsPerEm,
            ascender,
            descender,
            lineGap,
            capHeight,
            xHeight
        };
        // Parse hmtx table for glyph metrics
        const hmtxTable = parser.getTable(HMTX);
        if (!hmtxTable)
            throw new Error('Missing hmtx table');
        const glyphMetrics = new Map();
        const numGlyphs = numOfLongHorMetrics;
        for (let glyphId = 0; glyphId < numGlyphs; glyphId++) {
            const offset = glyphId * 4; // 2 bytes advanceWidth + 2 bytes leftSideBearing
            if (offset + 4 > hmtxTable.byteLength)
                break;
            const advanceWidth = parser.getUint16(hmtxTable, offset);
            const leftSideBearing = parser.getInt16(hmtxTable, offset + 2);
            glyphMetrics.set(glyphId, { advanceWidth, leftSideBearing });
        }
        // Parse cmap table for character to glyph mapping
        const cmapTable = parser.getTable(CMAP);
        if (!cmapTable)
            throw new Error('Missing cmap table');
        const cmap = new CmapParser(cmapTable);
        return new TtfFontMetrics(metrics, glyphMetrics, cmap);
    }
    catch (error) {
        throw new Error(`Failed to parse TTF font ${filePath}: ${error}`);
    }
}
