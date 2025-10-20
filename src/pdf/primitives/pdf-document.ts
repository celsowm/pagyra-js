import type { PdfMetadata } from "../types.js";
import { encodeAndEscapePdfText } from "../utils/encoding.js";
import { log } from "../../debug/log.js";

interface PdfFontResource {
  name: string;
  baseFont: string;
  objectRef: PdfObjectRef | null;
}

interface PdfImageResource {
  ref: PdfObjectRef;
  width: number;
  height: number;
  colorSpace: string;
  bitsPerComponent: number;
  filter?: string;
  data: Uint8Array;
  sMask?: PdfObjectRef;
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
  xObjects: Map<string, PdfObjectRef>;
  extGStates: Map<string, PdfObjectRef>;
}

export interface PdfObjectRef {
  objectNumber: number;
}

interface PdfObject {
  ref: PdfObjectRef;
  body: Buffer;
}

export class PdfDocument {
  private readonly fonts = new Map<string, PdfFontResource>();
  private readonly pages: PdfPage[] = [];
  private readonly images: PdfImageResource[] = [];
  private readonly extGStates = new Map<string, { ref: PdfObjectRef; alpha: number }>();
  private readonly shadings = new Map<string, { ref: PdfObjectRef; dict: string }>();
  private readonly patterns = new Map<string, { ref: PdfObjectRef; dict: string }>();

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
      fonts: page.resources?.fonts ?? new Map(),
      xObjects: page.resources?.xObjects ?? new Map(),
      extGStates: page.resources?.extGStates ?? new Map(),
    };
    this.pages.push({
      width: page.width,
      height: page.height,
      contents: page.contents,
      resources,
      annotations: page.annotations ?? [],
    });
  }

  registerImage(image: {
    src: string;
    width: number;
    height: number;
    format: "jpeg" | "png" | "gif" | "webp";
    channels: number;
    bitsPerComponent: number;
    data: Uint8Array;
  }): PdfObjectRef {
    if (image.format === 'png' && image.channels === 4) {
      const rgbData = new Uint8Array(image.width * image.height * 3);
      const alphaData = new Uint8Array(image.width * image.height);
      for (let i = 0, j = 0, k = 0; i < image.data.length; i += 4, j += 3, k++) {
        rgbData[j] = image.data[i];
        rgbData[j + 1] = image.data[i + 1];
        rgbData[j + 2] = image.data[i + 2];
        alphaData[k] = image.data[i + 3];
      }

      const sMaskRef: PdfObjectRef = { objectNumber: -1 };
      this.images.push({
        ref: sMaskRef,
        width: image.width,
        height: image.height,
        colorSpace: 'DeviceGray',
        bitsPerComponent: 8,
        data: alphaData,
        sMask: undefined,
      });

      const ref: PdfObjectRef = { objectNumber: -1 };
      this.images.push({
        ref,
        width: image.width,
        height: image.height,
        colorSpace: 'DeviceRGB',
        bitsPerComponent: 8,
        data: rgbData,
        sMask: sMaskRef,
      });
      return ref;
    }

    const colorSpace =
      image.channels === 1 ? "DeviceGray" : image.channels === 3 ? "DeviceRGB" : "DeviceRGB";
    const filter = image.format === "jpeg" ? "DCTDecode" : undefined;
    const ref: PdfObjectRef = { objectNumber: -1 };
    this.images.push({
      ref,
      width: image.width,
      height: image.height,
      colorSpace,
      bitsPerComponent: image.bitsPerComponent,
      filter,
      data: image.data.slice(),
      sMask: undefined,
    });
    return ref;
  }

  registerExtGState(alpha: number): PdfObjectRef {
    const normalized = clampUnitAlpha(alpha);
    const key = normalized.toFixed(4);
    const existing = this.extGStates.get(key);
    if (existing) {
      return existing.ref;
    }
    const ref: PdfObjectRef = { objectNumber: -1 };
    this.extGStates.set(key, { ref, alpha: normalized });
    return ref;
  }

  registerShading(name: string, dict: string): PdfObjectRef {
    const existing = this.shadings.get(name);
    if (existing) {
      return existing.ref;
    }
    const ref: PdfObjectRef = { objectNumber: -1 };
    this.shadings.set(name, { ref, dict });
    return ref;
  }

  registerPattern(name: string, dict: string): PdfObjectRef {
    const existing = this.patterns.get(name);
    if (existing) {
      return existing.ref;
    }
    const ref: PdfObjectRef = { objectNumber: -1 };
    this.patterns.set(name, { ref, dict });
    return ref;
  }

  finalize(): Uint8Array {
    const objects: PdfObject[] = [];

    const header = Buffer.from("%PDF-1.4\n", "binary");
    let currentObjectNumber = 1;
    const pushObject = (body: string | Buffer, ref?: PdfObjectRef | null): PdfObjectRef => {
      const objectRef = ref ?? { objectNumber: 0 };
      if (objectRef.objectNumber <= 0) {
        objectRef.objectNumber = currentObjectNumber++;
      }
      const payload = typeof body === "string" ? Buffer.from(body, "binary") : body;
      objects.push({ ref: objectRef, body: payload });
      return objectRef;
    };

    for (const font of this.fonts.values()) {
      font.objectRef = pushObject(serializeType1Font(font.baseFont), font.objectRef);
    }

    for (const state of this.extGStates.values()) {
      state.ref = pushObject(serializeExtGState(state.alpha), state.ref);
    }

    for (const image of this.images) {
      const entries = [
        "/Type /XObject",
        "/Subtype /Image",
        `/Width ${image.width}`,
        `/Height ${image.height}`,
        `/ColorSpace /${image.colorSpace}`,
        `/BitsPerComponent ${image.bitsPerComponent}`,
      ];
      if (image.filter) {
        entries.push(`/Filter /${image.filter}`);
      }
      if (image.sMask) {
        entries.push(`/SMask ${image.sMask.objectNumber} 0 R`);
      }
      const stream = serializeStream(image.data, entries);
      image.ref = pushObject(stream, image.ref);
    }

    const pageRefs: PdfObjectRef[] = [];

    for (const page of this.pages) {
      const contentRef = pushObject(serializeStream(page.contents));

      const fontEntries: string[] = [];
      for (const [alias, ref] of page.resources.fonts) {
        fontEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
      }

      const xObjectEntries: string[] = [];
      for (const [alias, ref] of page.resources.xObjects) {
        xObjectEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
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
      if (xObjectEntries.length > 0) {
        resourcesParts.push(`/XObject << ${xObjectEntries.join(" ")} >>`);
      }
      const gStateEntries: string[] = [];
      for (const [alias, ref] of page.resources.extGStates) {
        gStateEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
      }
      if (gStateEntries.length > 0) {
        resourcesParts.push(`/ExtGState << ${gStateEntries.join(" ")} >>`);
      }
      const resources = resourcesParts.length > 0 ? `/Resources << ${resourcesParts.join(" ")} >>` : "";
      const annots =
        annotationRefs.length > 0 ? `/Annots [${annotationRefs.map((r) => `${r.objectNumber} 0 R`).join(" ")}]` : "";
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

    let infoRef: PdfObjectRef | null = null;
    if (hasMetadata(this.metadata)) {
      infoRef = pushObject(serializeInfo(this.metadata));
    }

    const xrefEntries: string[] = ["0000000000 65535 f \n"];
    const chunks: Buffer[] = [header];
    let offset = header.length;

    for (const object of objects) {
      const objectHeader = Buffer.from(`${object.ref.objectNumber} 0 obj\n`, "binary");
      const objectFooter = Buffer.from("\nendobj\n", "binary");
      const objectBuffer = Buffer.concat([objectHeader, object.body, objectFooter]);
      xrefEntries.push(formatXref(offset));
      chunks.push(objectBuffer);
      offset += objectBuffer.length;
    }

    const xrefStart = offset;
    const size = currentObjectNumber;
    const trailerBody = Buffer.from(
      `xref\n0 ${size}\n${xrefEntries.join("")}trailer\n${serializeTrailer(size, catalogRef, infoRef)}\nstartxref\n${xrefStart}\n%%EOF\n`,
      "binary",
    );
    chunks.push(trailerBody);

    return Buffer.concat(chunks);
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

function serializeStream(content: string | Uint8Array, extraEntries: string[] = []): Buffer {
  const encoded = typeof content === "string" ? Buffer.from(content, "binary") : Buffer.from(content);
  const entries = [`/Length ${encoded.length}`, ...extraEntries].join(" ");
  const header = `<< ${entries} >>\nstream\n`;
  const footer = "\nendstream";
  return Buffer.concat([Buffer.from(header, "binary"), encoded, Buffer.from(footer, "binary")]);
}

function serializeExtGState(alpha: number): string {
  const safeAlpha = clampUnitAlpha(alpha);
  const formatted = formatNumber(safeAlpha);
  return ["<<", "/Type /ExtGState", `/ca ${formatted}`, `/CA ${formatted}`, ">>"].join("\n");
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

function clampUnitAlpha(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
