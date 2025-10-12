import type { PdfMetadata } from "../types.js";
import { encodeAndEscapePdfText } from "../utils/encoding.js";
import { log } from "../../debug/log.js";

interface PdfFontResource {
  name: string;
  baseFont: string;
  objectRef: PdfObjectRef | null;
}

interface PdfPage {
  width: number;
  height: number;
  contents: string;
  resources: PdfResources;
  annotations: string[];
}

interface PdfResources {
  fonts: Map<string, PdfObjectRef>;
}

export interface PdfObjectRef {
  objectNumber: number;
}

interface PdfObject {
  ref: PdfObjectRef;
  body: string;
}

export class PdfDocument {
  private readonly fonts = new Map<string, PdfFontResource>();
  private readonly pages: PdfPage[] = [];

  constructor(private readonly metadata: PdfMetadata = {}) {}

  registerStandardFont(baseFont: string): PdfObjectRef {
    const existing = this.fonts.get(baseFont);
    if (existing) {
      return existing.objectRef!;
    }
    const objectRef: PdfObjectRef = { objectNumber: -1 };
    this.fonts.set(baseFont, { name: baseFont, baseFont, objectRef });
    return objectRef;
  }

  addPage(page: Omit<PdfPage, "resources"> & { resources?: Partial<PdfResources> }): void {
    const resources: PdfResources = {
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

  finalize(): Uint8Array {
    const objects: PdfObject[] = [];

    const header = "%PDF-1.4\n";
    let currentObjectNumber = 1;
    const pushObject = (body: string, ref?: PdfObjectRef | null): PdfObjectRef => {
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

    const pageRefs: PdfObjectRef[] = [];

    for (const page of this.pages) {
      const contentRef = pushObject(serializeStream(page.contents));

      const fontEntries: string[] = [];
      for (const [alias, ref] of page.resources.fonts) {
        fontEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
      }

      const annotationRefs: PdfObjectRef[] = [];
      for (const annotation of page.annotations) {
        const annotRef = pushObject(annotation);
        annotationRefs.push(annotRef);
      }

      const resourcesParts: string[] = [];
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
    const pagesRef = pushObject(
      ["<<", "/Type /Pages", `/Count ${pageRefs.length}`, `/Kids [${kids}]`, ">>"].join("\n"),
    );
    const catalogRef = pushObject(["<<", "/Type /Catalog", `/Pages ${pagesRef.objectNumber} 0 R`, ">>"].join("\n"));

    let infoRef: PdfObjectRef | null = null;
    if (hasMetadata(this.metadata)) {
      infoRef = pushObject(serializeInfo(this.metadata));
    }

    const xrefEntries: string[] = ["0000000000 65535 f \n"];
    const chunks: string[] = [header];
    let offset = Buffer.byteLength(header, "binary");

    for (const object of objects) {
      const objectString = `${object.ref.objectNumber} 0 obj\n${object.body}\nendobj\n`;
      xrefEntries.push(formatXref(offset));
      chunks.push(objectString);
      offset += Buffer.byteLength(objectString, "binary");
    }

    const xrefStart = offset;
    const size = currentObjectNumber;
    const xrefBody = `xref\n0 ${size}\n${xrefEntries.join("")}trailer\n${serializeTrailer(
      size,
      catalogRef,
      infoRef,
    )}\nstartxref\n${xrefStart}\n%%EOF\n`;
    chunks.push(xrefBody);

    const pdfString = chunks.join("");
    return Buffer.from(pdfString, "binary");
  }

  // Backwards compatibility for earlier code paths expecting eager font creation.
  private createFontObject(baseFont: string): PdfObjectRef {
    return this.registerStandardFont(baseFont);
  }
}

function serializeType1Font(baseFont: string): string {
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

function usesSymbolEncoding(baseFont: string): boolean {
  const normalized = sanitizeName(baseFont).toLowerCase();
  return normalized === "symbol" || normalized === "zapfdingbats";
}

function serializeStream(content: string): string {
  const encoded = Buffer.from(content, "binary");
  return `<< /Length ${encoded.length} >>\nstream\n${content}\nendstream`;
}

function serializeInfo(meta: PdfMetadata): string {
  const entries: string[] = [];
  if (meta.title) {
    const encoded = encodeAndEscapePdfText(meta.title);
    log("PDF","DEBUG","serializing metadata title", { title: meta.title.slice(0, 50), encoded });
    entries.push(`/Title (${encoded})`);
  }
  if (meta.author) {
    const encoded = encodeAndEscapePdfText(meta.author);
    log("PDF","DEBUG","serializing metadata author", { author: meta.author.slice(0, 50), encoded });
    entries.push(`/Author (${encoded})`);
  }
  if (meta.subject) {
    const encoded = encodeAndEscapePdfText(meta.subject);
    log("PDF","DEBUG","serializing metadata subject", { subject: meta.subject.slice(0, 50), encoded });
    entries.push(`/Subject (${encoded})`);
  }
  if (meta.keywords?.length) {
    const keywordsText = meta.keywords.join(", ");
    const encoded = encodeAndEscapePdfText(keywordsText);
    log("PDF","DEBUG","serializing metadata keywords", { keywords: keywordsText.slice(0, 50), encoded });
    entries.push(`/Keywords (${encoded})`);
  }
  if (meta.producer) {
    const encoded = encodeAndEscapePdfText(meta.producer);
    log("PDF","DEBUG","serializing metadata producer", { producer: meta.producer.slice(0, 50), encoded });
    entries.push(`/Producer (${encoded})`);
  }
  return `<< ${entries.join(" ")} >>`;
}

function serializeTrailer(size: number, catalogRef: PdfObjectRef, infoRef: PdfObjectRef | null): string {
  const entries = [`/Size ${size}`, `/Root ${catalogRef.objectNumber} 0 R`];
  if (infoRef) {
    entries.push(`/Info ${infoRef.objectNumber} 0 R`);
  }
  return `<< ${entries.join(" ")} >>`;
}

function formatXref(offset: number): string {
  return `${offset.toString().padStart(10, "0")} 00000 n \n`;
}

function sanitizeName(name: string): string {
  return name.replace(/[^!-~]/g, "");
}

function hasMetadata(meta: PdfMetadata): boolean {
  return Boolean(meta.title || meta.author || meta.subject || meta.keywords?.length || meta.producer);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
