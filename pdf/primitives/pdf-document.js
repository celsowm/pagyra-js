import { encodeAndEscapePdfText } from "../utils/encoding.js";
export class PdfDocument {
    metadata;
    fonts = new Map();
    pages = [];
    constructor(metadata = {}) {
        this.metadata = metadata;
    }
    registerStandardFont(baseFont) {
        const existing = this.fonts.get(baseFont);
        if (existing) {
            return existing.objectRef;
        }
        const objectRef = { objectNumber: -1 };
        this.fonts.set(baseFont, { name: baseFont, baseFont, objectRef });
        return objectRef;
    }
    addPage(page) {
        const resources = {
            fonts: new Map(),
            ...page.resources,
        };
        this.pages.push({
            width: page.width,
            height: page.height,
            contents: page.contents,
            resources,
            annotations: page.annotations ?? [],
        });
    }
    finalize() {
        const objects = [];
        const header = "%PDF-1.4\n";
        let currentObjectNumber = 1;
        const pushObject = (body, ref) => {
            const objectRef = ref ?? { objectNumber: 0 };
            if (objectRef.objectNumber <= 0) {
                objectRef.objectNumber = currentObjectNumber++;
            }
            objects.push({ ref: objectRef, body });
            return objectRef;
        };
        // Materialize font objects.
        for (const font of this.fonts.values()) {
            font.objectRef = pushObject(serializeType1Font(font.baseFont), font.objectRef);
        }
        const pageRefs = [];
        for (const page of this.pages) {
            const contentRef = pushObject(serializeStream(page.contents));
            const fontEntries = [];
            for (const [alias, ref] of page.resources.fonts) {
                fontEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
            }
            const annotationRefs = [];
            for (const annotation of page.annotations) {
                const annotRef = pushObject(annotation);
                annotationRefs.push(annotRef);
            }
            const resourcesParts = [];
            if (fontEntries.length > 0) {
                resourcesParts.push(`/Font << ${fontEntries.join(" ")} >>`);
            }
            const resources = resourcesParts.length > 0 ? `/Resources << ${resourcesParts.join(" ")} >>` : "";
            const annots = annotationRefs.length > 0 ? `/Annots [${annotationRefs.map((r) => `${r.objectNumber} 0 R`).join(" ")}]` : "";
            const pageBody = [
                "<<",
                "/Type /Page",
                `/MediaBox [0 0 ${formatNumber(page.width)} ${formatNumber(page.height)}]`,
                resources,
                annots,
                `/Contents ${contentRef.objectNumber} 0 R`,
                ">>",
            ]
                .filter(Boolean)
                .join("\n");
            const pageRef = pushObject(pageBody);
            pageRefs.push(pageRef);
        }
        const kids = pageRefs.map((ref) => `${ref.objectNumber} 0 R`).join(" ");
        const pagesRef = pushObject(["<<", "/Type /Pages", `/Count ${pageRefs.length}`, `/Kids [${kids}]`, ">>"].join("\n"));
        const catalogRef = pushObject(["<<", "/Type /Catalog", `/Pages ${pagesRef.objectNumber} 0 R`, ">>"].join("\n"));
        let infoRef = null;
        if (hasMetadata(this.metadata)) {
            infoRef = pushObject(serializeInfo(this.metadata));
        }
        const xrefEntries = ["0000000000 65535 f \n"];
        const chunks = [header];
        let offset = Buffer.byteLength(header, "binary");
        for (const object of objects) {
            const objectString = `${object.ref.objectNumber} 0 obj\n${object.body}\nendobj\n`;
            xrefEntries.push(formatXref(offset));
            chunks.push(objectString);
            offset += Buffer.byteLength(objectString, "binary");
        }
        const xrefStart = offset;
        const size = currentObjectNumber;
        const xrefBody = `xref\n0 ${size}\n${xrefEntries.join("")}trailer\n${serializeTrailer(size, catalogRef, infoRef)}\nstartxref\n${xrefStart}\n%%EOF\n`;
        chunks.push(xrefBody);
        const pdfString = chunks.join("");
        return Buffer.from(pdfString, "binary");
    }
    // Backwards compatibility for earlier code paths expecting eager font creation.
    createFontObject(baseFont) {
        return this.registerStandardFont(baseFont);
    }
}
function serializeType1Font(baseFont) {
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
function usesSymbolEncoding(baseFont) {
    const normalized = sanitizeName(baseFont).toLowerCase();
    return normalized === "symbol" || normalized === "zapfdingbats";
}
function serializeStream(content) {
    const encoded = Buffer.from(content, "binary");
    return `<< /Length ${encoded.length} >>\nstream\n${content}\nendstream`;
}
function serializeInfo(meta) {
    const entries = [];
    if (meta.title)
        entries.push(`/Title (${encodeAndEscapePdfText(meta.title)})`);
    if (meta.author)
        entries.push(`/Author (${encodeAndEscapePdfText(meta.author)})`);
    if (meta.subject)
        entries.push(`/Subject (${encodeAndEscapePdfText(meta.subject)})`);
    if (meta.keywords?.length)
        entries.push(`/Keywords (${encodeAndEscapePdfText(meta.keywords.join(", "))})`);
    if (meta.producer)
        entries.push(`/Producer (${encodeAndEscapePdfText(meta.producer)})`);
    return `<< ${entries.join(" ")} >>`;
}
function serializeTrailer(size, catalogRef, infoRef) {
    const entries = [`/Size ${size}`, `/Root ${catalogRef.objectNumber} 0 R`];
    if (infoRef) {
        entries.push(`/Info ${infoRef.objectNumber} 0 R`);
    }
    return `<< ${entries.join(" ")} >>`;
}
function formatXref(offset) {
    return `${offset.toString().padStart(10, "0")} 00000 n \n`;
}
function sanitizeName(name) {
    return name.replace(/[^!-~]/g, "");
}
function hasMetadata(meta) {
    return Boolean(meta.title || meta.author || meta.subject || meta.keywords?.length || meta.producer);
}
function formatNumber(value) {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
