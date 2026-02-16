/**
 * Core PDF types and interfaces shared across PDF generation components.
 * These types define the structure of PDF resources and objects.
 */

export interface PdfObjectRef {
    objectNumber: number;
}

export interface PdfFontResource {
    name: string;
    baseFont: string;
    objectRef: PdfObjectRef | null;
}

export interface PdfImageResource {
    ref: PdfObjectRef;
    src?: string;
    width: number;
    height: number;
    colorSpace: string;
    bitsPerComponent: number;
    filter?: string;
    data: Uint8Array;
    sMask?: PdfObjectRef;
}

export interface PdfPage {
    width: number;
    height: number;
    contents: string;
    resources: PdfResources;
    annotations?: string[];
}

export interface PdfResources {
    fonts: Map<string, PdfObjectRef>;
    xObjects: Map<string, PdfObjectRef>;
    extGStates: Map<string, PdfObjectRef>;
    shadings: Map<string, PdfObjectRef>;
    patterns?: Map<string, PdfObjectRef>;
}

export interface PdfObject {
    ref: PdfObjectRef;
    body: Uint8Array;
}

export interface PdfExtGStateResource {
    ref: PdfObjectRef;
    alpha: number;
}

export interface PdfShadingResource {
    ref: PdfObjectRef;
    dict: string;
}

export interface PdfPatternResource {
    ref: PdfObjectRef;
    dict: string;
}

export interface PdfRegisteredObject {
    ref: PdfObjectRef;
    value: unknown;
}

export interface PdfRegisteredStream {
    ref: PdfObjectRef;
    data: Uint8Array;
    headers: Record<string, string>;
}
