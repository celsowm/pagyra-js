import { describe, expect, it } from "vitest";
import path from "node:path";
import { renderHtmlToPdf } from "../../src/html-to-pdf.js";
import { TtfTableParser } from "../../src/pdf/font/ttf-table-parser.js";

function tagToInt(tag: string): number {
    return tag.split("").reduce((acc, char) => (acc << 8) | char.charCodeAt(0), 0) >>> 0;
}

function getRequiredTable(parser: TtfTableParser, tag: string): DataView {
    const table = parser.getTable(tagToInt(tag));
    if (!table) {
        throw new Error(`Missing table '${tag}' in embedded subset font`);
    }
    return table;
}

function extractFontFile2(pdfBytes: Uint8Array): Uint8Array {
    const text = new TextDecoder("latin1").decode(pdfBytes);
    const fontFile2RefMatch = /\/FontFile2\s+(\d+)\s+0\s+R/.exec(text);
    if (!fontFile2RefMatch) {
        throw new Error("FontFile2 reference not found in PDF");
    }

    const objectNumber = Number(fontFile2RefMatch[1]);
    const objectHeader = `${objectNumber} 0 obj\n`;
    const objectStart = text.indexOf(objectHeader);
    if (objectStart < 0) {
        throw new Error(`FontFile2 object ${objectNumber} not found in PDF`);
    }

    const streamMarker = "stream\n";
    const streamHeaderStart = text.indexOf(streamMarker, objectStart);
    if (streamHeaderStart < 0) {
        throw new Error(`FontFile2 object ${objectNumber} has no stream`);
    }

    const dictText = text.slice(objectStart + objectHeader.length, streamHeaderStart);
    const lengthMatch = /\/Length\s+(\d+)/.exec(dictText);
    if (!lengthMatch) {
        throw new Error(`FontFile2 object ${objectNumber} has no /Length`);
    }

    const streamLength = Number(lengthMatch[1]);
    const streamStart = streamHeaderStart + streamMarker.length;
    const streamEnd = streamStart + streamLength;
    if (streamEnd > pdfBytes.byteLength) {
        throw new Error("FontFile2 stream length exceeds PDF size");
    }

    const endStreamMarker = text.slice(streamEnd, streamEnd + "\nendstream".length);
    if (endStreamMarker !== "\nendstream") {
        throw new Error("FontFile2 stream terminator mismatch");
    }

    return pdfBytes.slice(streamStart, streamEnd);
}

describe("subset font table consistency", () => {
    it("keeps head/maxp/hhea/cmap consistent with loca length", async () => {
        process.env.PAGYRA_FONTS_DIR = path.resolve(process.cwd(), "assets/fonts");

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Tinos', serif; font-size: 24px; }
                </style>
            </head>
            <body>
                Hello World with Tinos! ação, acentuação, coração.
            </body>
            </html>
        `;

        const pdfBytes = await renderHtmlToPdf({
            html,
            pageWidth: 600,
            pageHeight: 800,
            assetRootDir: path.resolve(process.cwd(), "assets")
        });

        const fontFile2 = extractFontFile2(pdfBytes);
        const ttfBuffer = new ArrayBuffer(fontFile2.byteLength);
        new Uint8Array(ttfBuffer).set(fontFile2);
        const parser = new TtfTableParser(ttfBuffer);

        const maxp = getRequiredTable(parser, "maxp");
        const head = getRequiredTable(parser, "head");
        const loca = getRequiredTable(parser, "loca");
        const hhea = getRequiredTable(parser, "hhea");
        const cmap = getRequiredTable(parser, "cmap");

        const numGlyphs = maxp.getUint16(4, false);
        expect(numGlyphs).toBeGreaterThan(0);

        const indexToLocFormat = head.getUint16(50, false);
        expect(indexToLocFormat === 0 || indexToLocFormat === 1).toBe(true);

        const expectedLocaLength = (numGlyphs + 1) * (indexToLocFormat === 0 ? 2 : 4);
        expect(loca.byteLength).toBe(expectedLocaLength);

        const numberOfHMetrics = hhea.getUint16(34, false);
        expect(numberOfHMetrics).toBe(numGlyphs);

        const numCmapTables = cmap.getUint16(2, false);
        expect(numCmapTables).toBeGreaterThan(0);

        let format4Offset = -1;
        for (let i = 0; i < numCmapTables; i++) {
            const recordOffset = 4 + i * 8;
            const subtableOffset = cmap.getUint32(recordOffset + 4, false);
            if (subtableOffset + 4 > cmap.byteLength) {
                continue;
            }
            const format = cmap.getUint16(subtableOffset, false);
            if (format === 4) {
                format4Offset = subtableOffset;
                break;
            }
        }

        expect(format4Offset).toBeGreaterThanOrEqual(0);
        const format4Length = cmap.getUint16(format4Offset + 2, false);
        expect(format4Length).toBeGreaterThan(0);
        expect(format4Offset + format4Length).toBeLessThanOrEqual(cmap.byteLength);
        expect(format4Length).toBe(cmap.byteLength - format4Offset);
    });
});
