import type { PdfMetadata } from "../types.js";
import type { PdfObjectRef, PdfObject, PdfPage } from "./pdf-types.js";
import { PdfReferenceManager } from "./pdf-reference-manager.js";
import {
    FontRegistry,
    ImageRegistry,
    ExtGStateRegistry,
    ShadingRegistry,
    PatternRegistry,
    ObjectRegistry,
    StreamRegistry,
} from "./pdf-resource-registries.js";
import {
    serializeValue,
    serializeType1Font,
    serializeExtGState,
    serializeStream,
    serializeInfo,
    serializeTrailer,
    formatXref,
    formatNumber,
    hasMetadata,
} from "./pdf-serializers.js";
import { concatBytes, encodeBinaryString } from "./pdf-bytes.js";

/**
 * Orchestrates PDF document generation by coordinating resource registries,
 * reference management, and serialization.
 * 
 * This class follows the Single Responsibility Principle by focusing on
 * assembling the PDF document from registered resources.
 */
export class PdfBuilder {
    private readonly pages: PdfPage[] = [];
    private readonly refManager = new PdfReferenceManager();

    // Public registries for resource management
    readonly fontRegistry = new FontRegistry();
    readonly imageRegistry = new ImageRegistry();
    readonly extGStateRegistry = new ExtGStateRegistry();
    readonly shadingRegistry = new ShadingRegistry();
    readonly patternRegistry = new PatternRegistry();
    readonly objectRegistry = new ObjectRegistry();
    readonly streamRegistry = new StreamRegistry();

    constructor(private readonly metadata: PdfMetadata = {}) { }

    /**
     * Adds a page to the document.
     */
    addPage(page: PdfPage): void {
        this.pages.push(page);
    }

    /**
     * Finalizes the document and returns the complete PDF as bytes.
     */
    finalize(): Uint8Array {
        const objects: PdfObject[] = [];
        const header = encodeBinaryString("%PDF-1.4\n");

        // Helper to push objects with proper reference assignment
        const pushObject = (
            body: string | Uint8Array | unknown,
            ref?: PdfObjectRef | null
        ): PdfObjectRef => {
            const objectRef = this.refManager.ensureRefNumber(ref ?? { objectNumber: 0 });
            let payload: Uint8Array;

            if (typeof body === "string") {
                payload = encodeBinaryString(body);
            } else if (body instanceof Uint8Array) {
                payload = body;
            } else {
                const serialized = serializeValue(body as Record<string, unknown> | readonly unknown[]);
                payload = encodeBinaryString(serialized);
            }

            objects.push({ ref: objectRef, body: payload });
            return objectRef;
        };

        // Reserve object numbers for streams/objects that may be referenced
        this.reserveObjectNumbers();

        // Build all PDF objects
        this.buildFonts(pushObject);
        this.buildExtGStates(pushObject);
        this.buildShadings(pushObject);
        this.buildPatterns(pushObject);
        this.buildImages(pushObject);
        this.buildStreams(pushObject);
        this.buildCustomObjects(pushObject);

        const pageRefs = this.buildPages(pushObject);
        const pagesRef = this.buildPagesTree(pageRefs, pushObject);
        const catalogRef = this.buildCatalog(pagesRef, pushObject);
        const infoRef = this.buildMetadata(pushObject);

        return this.assemblePdf(header, objects, catalogRef, infoRef);
    }

    /**
     * Reserves object numbers for resources that may be referenced by others.
     */
    private reserveObjectNumbers(): void {
        for (const stream of this.streamRegistry.getAll()) {
            this.refManager.ensureRefNumber(stream.ref);
        }
        for (const obj of this.objectRegistry.getAll()) {
            this.refManager.ensureRefNumber(obj.ref);
        }
        for (const pattern of this.patternRegistry.getAll()) {
            this.refManager.ensureRefNumber(pattern.ref);
        }
    }

    /**
     * Builds font objects.
     */
    private buildFonts(pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef): void {
        for (const font of this.fontRegistry.getAll()) {
            font.objectRef = pushObject(serializeType1Font(font.baseFont), font.objectRef);
        }
    }

    /**
     * Builds ExtGState objects.
     */
    private buildExtGStates(pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef): void {
        for (const state of this.extGStateRegistry.getAll()) {
            state.ref = pushObject(serializeExtGState(state.alpha), state.ref);
        }
    }

    /**
     * Builds shading objects.
     */
    private buildShadings(pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef): void {
        for (const shading of this.shadingRegistry.getAll()) {
            shading.ref = pushObject(shading.dict, shading.ref);
        }
    }

    /**
     * Builds pattern objects.
     */
    private buildPatterns(pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef): void {
        for (const pattern of this.patternRegistry.getAll()) {
            pattern.ref = pushObject(pattern.dict, pattern.ref);
        }
    }

    /**
     * Builds image XObject streams.
     */
    private buildImages(pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef): void {
        for (const image of this.imageRegistry.getAll()) {
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
    }

    /**
     * Builds custom stream objects.
     */
    private buildStreams(pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef): void {
        for (const stream of this.streamRegistry.getAll()) {
            const entries = Object.entries(stream.headers).map(([k, v]) => `/${k} ${v}`);
            const body = serializeStream(stream.data, entries);
            stream.ref = pushObject(body, stream.ref);
        }
    }

    /**
     * Builds custom registered objects.
     */
    private buildCustomObjects(pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef): void {
        for (const obj of this.objectRegistry.getAll()) {
            obj.ref = pushObject(obj.value, obj.ref);
        }
    }

    /**
     * Builds page objects and returns their references.
     */
    private buildPages(pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef): PdfObjectRef[] {
        const pageRefs: PdfObjectRef[] = [];

        for (const page of this.pages) {
            const contentRef = pushObject(serializeStream(page.contents));

            const resourcesParts = this.buildPageResources(page);
            const annotationRefs = this.buildPageAnnotations(page, pushObject);

            const resources = resourcesParts.length > 0 ? `/Resources << ${resourcesParts.join(" ")} >>` : "";
            const annots = annotationRefs.length > 0
                ? `/Annots [${annotationRefs.map((r) => `${r.objectNumber} 0 R`).join(" ")}]`
                : "";

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

        return pageRefs;
    }

    /**
     * Builds page resources dictionary parts.
     */
    private buildPageResources(page: PdfPage): string[] {
        const resourcesParts: string[] = [];

        // Fonts
        const fontEntries: string[] = [];
        for (const [alias, ref] of page.resources.fonts) {
            fontEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
        }
        if (fontEntries.length > 0) {
            resourcesParts.push(`/Font << ${fontEntries.join(" ")} >>`);
        }

        // XObjects (images)
        const xObjectEntries: string[] = [];
        for (const [alias, ref] of page.resources.xObjects) {
            xObjectEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
        }
        if (xObjectEntries.length > 0) {
            resourcesParts.push(`/XObject << ${xObjectEntries.join(" ")} >>`);
        }

        // ExtGStates
        const gStateEntries: string[] = [];
        for (const [alias, ref] of page.resources.extGStates) {
            gStateEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
        }
        if (gStateEntries.length > 0) {
            resourcesParts.push(`/ExtGState << ${gStateEntries.join(" ")} >>`);
        }

        // Shadings
        const shadingEntries: string[] = [];
        for (const [alias, ref] of page.resources.shadings) {
            shadingEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
        }
        if (shadingEntries.length > 0) {
            resourcesParts.push(`/Shading << ${shadingEntries.join(" ")} >>`);
        }

        // Patterns
        const patternEntries: string[] = [];
        if (page.resources.patterns) {
            for (const [alias, ref] of page.resources.patterns) {
                patternEntries.push(`/${alias} ${ref.objectNumber} 0 R`);
            }
            if (patternEntries.length > 0) {
                resourcesParts.push(`/Pattern << ${patternEntries.join(" ")} >>`);
            }
        }

        return resourcesParts;
    }

    /**
     * Builds page annotation objects.
     */
    private buildPageAnnotations(
        page: PdfPage,
        pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef
    ): PdfObjectRef[] {
        const annotationRefs: PdfObjectRef[] = [];
        for (const annotation of page.annotations) {
            const annotRef = pushObject(annotation);
            annotationRefs.push(annotRef);
        }
        return annotationRefs;
    }

    /**
     * Builds the Pages tree object.
     */
    private buildPagesTree(
        pageRefs: PdfObjectRef[],
        pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef
    ): PdfObjectRef {
        const kids = pageRefs.map((ref) => `${ref.objectNumber} 0 R`).join(" ");
        return pushObject(
            ["<<", "/Type /Pages", `/Count ${pageRefs.length}`, `/Kids [${kids}]`, ">>"].join("\n")
        );
    }

    /**
     * Builds the Catalog object.
     */
    private buildCatalog(
        pagesRef: PdfObjectRef,
        pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef
    ): PdfObjectRef {
        return pushObject(
            ["<<", "/Type /Catalog", `/Pages ${pagesRef.objectNumber} 0 R`, ">>"].join("\n")
        );
    }

    /**
     * Builds the Info (metadata) object if metadata is present.
     */
    private buildMetadata(
        pushObject: (body: string | Uint8Array | unknown, ref?: PdfObjectRef | null) => PdfObjectRef
    ): PdfObjectRef | null {
        if (hasMetadata(this.metadata)) {
            return pushObject(serializeInfo(this.metadata));
        }
        return null;
    }

    /**
     * Assembles the final PDF byte array.
     */
    private assemblePdf(
        header: Uint8Array,
        objects: PdfObject[],
        catalogRef: PdfObjectRef,
        infoRef: PdfObjectRef | null
    ): Uint8Array {
        const xrefEntries: string[] = ["0000000000 65535 f \n"];
        const chunks: Uint8Array[] = [header];
        let offset = header.length;

        // Write all objects
        for (const object of objects) {
            const objectHeader = encodeBinaryString(`${object.ref.objectNumber} 0 obj\n`);
            const objectFooter = encodeBinaryString("\nendobj\n");
            const objectBuffer = concatBytes([objectHeader, object.body, objectFooter]);
            xrefEntries.push(formatXref(offset));
            chunks.push(objectBuffer);
            offset += objectBuffer.length;
        }

        // Write cross-reference table and trailer
        const xrefStart = offset;
        const size = this.refManager.getObjectCount();
        const trailerBody = encodeBinaryString(
            `xref\n0 ${size}\n${xrefEntries.join("")}trailer\n${serializeTrailer(size, catalogRef, infoRef)}\nstartxref\n${xrefStart}\n%%EOF\n`
        );
        chunks.push(trailerBody);

        return concatBytes(chunks);
    }
}
