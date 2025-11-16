import type { PdfObjectRef } from "../primitives/pdf-document.js";
import type { PdfDocument } from "../primitives/pdf-document.js";
import type { PainterResult } from "../page-painter.js";

export interface PageResources {
  fonts: Map<string, PdfObjectRef>;
  xObjects: Map<string, PdfObjectRef>;
  extGStates: Map<string, PdfObjectRef>;
  shadings: Map<string, PdfObjectRef>;
}

export function registerPageResources(doc: PdfDocument, result: PainterResult): PageResources {
  const xObjects = new Map<string, PdfObjectRef>();
  for (const image of result.images) {
    const ref = doc.registerImage(image.image);
    image.ref = ref;
    xObjects.set(image.alias, ref);
  }

  const extGStates = new Map<string, PdfObjectRef>();
  for (const [name, alpha] of result.graphicsStates) {
    const ref = doc.registerExtGState(alpha);
    extGStates.set(name, ref);
  }

  const shadings = new Map<string, PdfObjectRef>();
  for (const [name, dict] of result.shadings) {
    const ref = doc.registerShading(name, dict);
    shadings.set(name, ref);
  }

  return {
    fonts: result.fonts,
    xObjects,
    extGStates,
    shadings,
  };
}
