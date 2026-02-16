import { describe, it, expect } from "vitest";
import { PdfDocument } from "../../src/pdf/primitives/pdf-document.js";

/**
 * Parses the generated PDF bytes and validates that every xref entry
 * points to the correct byte offset of its corresponding "N 0 obj" marker.
 */
function validateXref(pdfBytes: Uint8Array): { mismatches: { obj: number; xrefOffset: number; actualOffset: number }[] } {
    const text = new TextDecoder("latin1").decode(pdfBytes);

    // Collect actual byte offsets of each "N 0 obj\n" marker
    const actualOffsets = new Map<number, number>();
    const objRegex = /(\d+) 0 obj\n/g;
    let m: RegExpExecArray | null;
    while ((m = objRegex.exec(text)) !== null) {
        actualOffsets.set(Number(m[1]), m.index);
    }

    // Locate xref table via startxref pointer
    const startxrefMatch = /startxref\n(\d+)\n%%EOF\s*$/.exec(text);
    if (!startxrefMatch) {
        throw new Error("startxref not found in PDF");
    }
    const xrefOffset = Number(startxrefMatch[1]);
    const xrefText = text.slice(xrefOffset);
    const trailerIdx = xrefText.indexOf("trailer\n");
    const body = xrefText.slice(0, trailerIdx);
    const lines = body.split("\n").filter(Boolean);

    // lines[0] = "xref", lines[1] = "0 N" (start + size)
    const [start, size] = lines[1].trim().split(/\s+/).map(Number);
    const entries = lines.slice(2);

    const mismatches: { obj: number; xrefOffset: number; actualOffset: number }[] = [];
    for (let obj = start; obj < start + size; obj++) {
        if (obj === 0) continue; // skip free entry
        const line = entries[obj - start];
        if (!line) continue;
        const xoff = Number(line.slice(0, 10));
        const actual = actualOffsets.get(obj);
        if (actual !== undefined && xoff !== actual) {
            mismatches.push({ obj, xrefOffset: xoff, actualOffset: actual });
        }
    }

    return { mismatches };
}

describe("xref table integrity", () => {
    it("xref offsets are correct when objects are written in sequential order", () => {
        const doc = new PdfDocument({ title: "sequential" });
        const fontRef = doc.registerStandardFont("Helvetica");

        doc.addPage({
            width: 595,
            height: 842,
            contents: "BT /F1 12 Tf 72 720 Td (Hello) Tj ET\n",
            resources: {
                fonts: new Map([["F1", fontRef]]),
            },
        });

        const pdf = doc.finalize();
        const { mismatches } = validateXref(pdf);
        expect(mismatches).toEqual([]);
    });

    it("xref offsets are correct when reserveObjectNumbers causes out-of-order writes", () => {
        const doc = new PdfDocument({ title: "out-of-order" });

        // Register pattern FIRST — this reserves an objectNumber early
        const patternRef = doc.registerPattern("P0", "<< /PatternType 2 /Shading null >>");

        // Register font SECOND — written first in buildFonts, but has higher objectNumber
        const fontRef = doc.registerStandardFont("Helvetica");

        doc.addPage({
            width: 595,
            height: 842,
            contents: "BT /F1 12 Tf 72 720 Td (Hello) Tj ET\n",
            resources: {
                fonts: new Map([["F1", fontRef]]),
                patterns: new Map([["P0", patternRef]]),
            },
        });

        const pdf = doc.finalize();
        const { mismatches } = validateXref(pdf);
        expect(mismatches).toEqual([]);
    });

    it("xref offsets are correct with multiple reserved resource types", () => {
        const doc = new PdfDocument({ title: "multi-reserve" });

        // Reserve stream, pattern, and custom object before fonts
        const streamData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
        const streamRef = doc.registerStream(streamData);
        const patternRef = doc.registerPattern("P0", "<< /PatternType 2 /Shading null >>");
        const customRef = doc.register({ Type: "/Custom", Value: 42 });

        const fontRef = doc.registerStandardFont("Courier");
        const shadingRef = doc.registerShading("S0", "<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [0 0 1 1] /Function null >>");

        doc.addPage({
            width: 595,
            height: 842,
            contents: "BT /F1 10 Tf 72 700 Td (Test) Tj ET\n",
            resources: {
                fonts: new Map([["F1", fontRef]]),
                xObjects: new Map([["Str0", streamRef]]),
                shadings: new Map([["S0", shadingRef]]),
                patterns: new Map([["P0", patternRef]]),
            },
        });

        const pdf = doc.finalize();
        const { mismatches } = validateXref(pdf);
        expect(mismatches).toEqual([]);
    });

    it("xref offsets are correct with multiple pages and images", () => {
        const doc = new PdfDocument({ title: "multi-page" });

        // 1x1 red PNG
        const imgRef = doc.registerImage({
            src: "red.png",
            width: 1,
            height: 1,
            format: "png",
            channels: 3,
            bitsPerComponent: 8,
            data: new Uint8Array([0xff, 0x00, 0x00]),
        });

        const patternRef = doc.registerPattern("P1", "<< /PatternType 1 /PaintType 1 /TilingType 1 >>");
        const fontRef = doc.registerStandardFont("Times-Roman");

        // Page 1
        doc.addPage({
            width: 595,
            height: 842,
            contents: "BT /F1 12 Tf 72 720 Td (Page 1) Tj ET\n",
            resources: {
                fonts: new Map([["F1", fontRef]]),
                xObjects: new Map([["Im0", imgRef]]),
                patterns: new Map([["P1", patternRef]]),
            },
        });

        // Page 2
        doc.addPage({
            width: 595,
            height: 842,
            contents: "BT /F1 12 Tf 72 720 Td (Page 2) Tj ET\n",
            resources: {
                fonts: new Map([["F1", fontRef]]),
            },
        });

        const pdf = doc.finalize();
        const { mismatches } = validateXref(pdf);
        expect(mismatches).toEqual([]);
    });
});
