import type { PdfMetadata } from "../types.js";
import type { PdfObjectRef, PdfPage, PdfResources } from "./pdf-types.js";
import { PdfBuilder } from "./pdf-builder.js";

/**
 * Main PDF document class that provides a public API for PDF generation.
 * 
 * This class now acts as a thin facade over the PdfBuilder architecture,
 * delegating all responsibilities to focused, single-purpose components.
 * The public API remains unchanged for backward compatibility.
 */
export class PdfDocument {
  private readonly builder: PdfBuilder;

  constructor(metadata: PdfMetadata = {}) {
    this.builder = new PdfBuilder(metadata);
  }

  /**
   * Registers a standard Type1 font and returns a reference to it.
   */
  registerStandardFont(baseFont: string): PdfObjectRef {
    return this.builder.fontRegistry.register(baseFont);
  }

  /**
   * Adds a page to the document.
   */
  addPage(page: Omit<PdfPage, "resources"> & { resources?: Partial<PdfResources> }): void {
    const resources: PdfResources = {
      fonts: page.resources?.fonts ?? new Map(),
      xObjects: page.resources?.xObjects ?? new Map(),
      extGStates: page.resources?.extGStates ?? new Map(),
      shadings: page.resources?.shadings ?? new Map(),
      patterns: page.resources?.patterns ?? new Map(),
    };

    this.builder.addPage({
      width: page.width,
      height: page.height,
      contents: page.contents,
      resources,
      annotations: page.annotations ?? [],
    });
  }

  /**
   * Registers an image and returns a reference to it.
   * Handles deduplication and PNG alpha channel separation automatically.
   */
  registerImage(image: {
    src: string;
    width: number;
    height: number;
    format: "jpeg" | "png" | "gif" | "webp";
    channels: number;
    bitsPerComponent: number;
    data: Uint8Array;
  }): PdfObjectRef {
    return this.builder.imageRegistry.register(image);
  }

  /**
   * Registers an ExtGState with the given alpha value.
   * Automatically deduplicates by alpha value.
   */
  registerExtGState(alpha: number): PdfObjectRef {
    return this.builder.extGStateRegistry.register(alpha);
  }

  /**
   * Registers a shading resource.
   */
  registerShading(name: string, dict: string): PdfObjectRef {
    return this.builder.shadingRegistry.register(name, dict);
  }

  /**
   * Registers a pattern resource.
   */
  registerPattern(name: string, dict: string): PdfObjectRef {
    return this.builder.patternRegistry.register(name, dict);
  }

  /**
   * Registers a custom PDF object.
   */
  register(value: string | Record<string, unknown> | readonly unknown[] | object): PdfObjectRef {
    return this.builder.objectRegistry.register(value);
  }

  /**
   * Registers a stream object with custom headers.
   */
  registerStream(data: Uint8Array, extraHeaders: Record<string, string> = {}): PdfObjectRef {
    return this.builder.streamRegistry.register(data, extraHeaders);
  }

  /**
   * Finalizes the PDF document and returns the complete PDF as a byte array.
   */
  finalize(): Uint8Array {
    return this.builder.finalize();
  }
}

// Re-export PdfObjectRef for backward compatibility
export type { PdfObjectRef } from "./pdf-types.js";
