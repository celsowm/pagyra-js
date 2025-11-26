import type { PdfObjectRef } from "./pdf-types.js";
import type { PdfMetadata } from "../types.js";
import { encodeAndEscapePdfText } from "../utils/encoding.js";
import { log } from "../../logging/debug.js";

/**
 * Pure serialization functions for PDF objects and values.
 * These functions follow the Single Responsibility Principle and are
 * easy to test in isolation.
 */

/**
 * Serializes a JavaScript value to PDF syntax.
 */
export function serializeValue(value: unknown): string {
    if (typeof value === "number") return formatNumber(value);
    if (typeof value === "string") return value;
    if (Array.isArray(value))
        return `[${value.map((v) => serializeValue(v)).join(" ")}]`;
    if (typeof value === "object" && value !== null && "objectNumber" in value)
        return `${(value as { objectNumber: number }).objectNumber} 0 R`;
    if (typeof value === "object" && value !== null) {
        const entries = Object.entries(value).map(
            ([k, v]) => `/${k} ${serializeValue(v)}`
        );
        return `<< ${entries.join(" ")} >>`;
    }
    return "null";
}

/**
 * Serializes a Type1 font dictionary.
 */
export function serializeType1Font(baseFont: string): string {
    const body = [
        "<<",
        "/Type /Font",
        "/Subtype /Type1",
        `/BaseFont /${sanitizeName(baseFont)}`,
    ];
    if (!usesSymbolEncoding(baseFont)) {
        body.push("/Encoding /WinAnsiEncoding");
    }
    body.push(">>");
    return body.join("\n");
}

/**
 * Serializes an ExtGState dictionary with alpha values.
 */
export function serializeExtGState(alpha: number): string {
    const safeAlpha = clampUnitAlpha(alpha);
    const formatted = formatNumber(safeAlpha);
    return ["<<", "/Type /ExtGState", `/ca ${formatted}`, `/CA ${formatted}`, ">>"].join("\n");
}

/**
 * Creates a PDF stream object with the given content and headers.
 */
export function serializeStream(
    content: string | Uint8Array,
    extraEntries: string[] = []
): Buffer {
    const encoded =
        typeof content === "string"
            ? Buffer.from(content, "binary")
            : Buffer.from(content);
    const entries = [`/Length ${encoded.length}`, ...extraEntries].join(" ");
    const header = `<< ${entries} >>\nstream\n`;
    const footer = "\nendstream";
    return Buffer.concat([
        Buffer.from(header, "binary"),
        encoded,
        Buffer.from(footer, "binary"),
    ]);
}

/**
 * Serializes PDF metadata (Info dictionary).
 */
export function serializeInfo(meta: PdfMetadata): string {
    const entries: string[] = [];

    if (meta.title) {
        const encoded = encodeAndEscapePdfText(meta.title);
        log("pdf", "debug", "serializing metadata title", {
            title: meta.title.slice(0, 50),
            encoded,
        });
        entries.push(`/Title (${encoded})`);
    }

    if (meta.author) {
        const encoded = encodeAndEscapePdfText(meta.author);
        log("pdf", "debug", "serializing metadata author", {
            author: meta.author.slice(0, 50),
            encoded,
        });
        entries.push(`/Author (${encoded})`);
    }

    if (meta.subject) {
        const encoded = encodeAndEscapePdfText(meta.subject);
        log("pdf", "debug", "serializing metadata subject", {
            subject: meta.subject.slice(0, 50),
            encoded,
        });
        entries.push(`/Subject (${encoded})`);
    }

    if (meta.keywords?.length) {
        const keywordsText = meta.keywords.join(", ");
        const encoded = encodeAndEscapePdfText(keywordsText);
        log("pdf", "debug", "serializing metadata keywords", {
            keywords: keywordsText.slice(0, 50),
            encoded,
        });
        entries.push(`/Keywords (${encoded})`);
    }

    if (meta.producer) {
        const encoded = encodeAndEscapePdfText(meta.producer);
        log("pdf", "debug", "serializing metadata producer", {
            producer: meta.producer.slice(0, 50),
            encoded,
        });
        entries.push(`/Producer (${encoded})`);
    }

    return `<< ${entries.join(" ")} >>`;
}

/**
 * Serializes the PDF trailer dictionary.
 */
export function serializeTrailer(
    size: number,
    catalogRef: PdfObjectRef,
    infoRef: PdfObjectRef | null
): string {
    const entries = [`/Size ${size}`, `/Root ${catalogRef.objectNumber} 0 R`];
    if (infoRef) {
        entries.push(`/Info ${infoRef.objectNumber} 0 R`);
    }
    return `<< ${entries.join(" ")} >>`;
}

/**
 * Formats a cross-reference table entry.
 */
export function formatXref(offset: number): string {
    return `${offset.toString().padStart(10, "0")} 00000 n \n`;
}

/**
 * Formats a number for PDF output, removing trailing zeros from decimals.
 */
export function formatNumber(value: number): string {
    return Number.isInteger(value)
        ? value.toString()
        : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Sanitizes a PDF name by removing non-printable characters.
 */
export function sanitizeName(name: string): string {
    return name.replace(/[^!-~]/g, "");
}

/**
 * Checks if a font uses symbol encoding (Symbol or ZapfDingbats).
 */
export function usesSymbolEncoding(baseFont: string): boolean {
    const normalized = sanitizeName(baseFont).toLowerCase();
    return normalized === "symbol" || normalized === "zapfdingbats";
}

/**
 * Checks if metadata object has any fields set.
 */
export function hasMetadata(meta: PdfMetadata): boolean {
    return Boolean(
        meta.title ||
        meta.author ||
        meta.subject ||
        meta.keywords?.length ||
        meta.producer
    );
}

/**
 * Clamps alpha value to [0, 1] range.
 */
export function clampUnitAlpha(value: number): number {
    if (!Number.isFinite(value)) return 1;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}
