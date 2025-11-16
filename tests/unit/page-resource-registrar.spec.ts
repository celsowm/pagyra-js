import { describe, it, expect, vi } from "vitest";
import type { PdfDocument } from "../../src/pdf/primitives/pdf-document.js";
import type { PdfObjectRef } from "../../src/pdf/primitives/pdf-document.js";
import type { PainterResult } from "../../src/pdf/page-painter.js";
import { registerPageResources } from "../../src/pdf/utils/page-resource-registrar.js";

const createPdfRef = (id: number): PdfObjectRef => ({ objectNumber: id });

describe("page-resource-registrar", () => {
  it("registers image, graphics states and shadings", () => {
    const registerImage = vi.fn().mockReturnValue(createPdfRef(5));
    const registerExtGState = vi.fn().mockReturnValue(createPdfRef(6));
    const registerShading = vi.fn().mockReturnValue(createPdfRef(7));
    const docStub = {
      registerImage,
      registerExtGState,
      registerShading,
    } as unknown as PdfDocument;

    const painterResult: PainterResult = {
      content: "",
      fonts: new Map(),
      images: [
        {
          alias: "img1",
          image: {
            src: "foo",
            width: 10,
            height: 20,
            format: "png",
            channels: 4,
            bitsPerComponent: 8,
            data: new Uint8Array([0]),
          },
        },
      ],
      graphicsStates: new Map([["gs1", 0.5]]),
      shadings: new Map([["sh1", "dict"]]),
    };

    const resources = registerPageResources(docStub, painterResult);

    expect(registerImage).toHaveBeenCalledWith(painterResult.images[0].image);
    expect(registerExtGState).toHaveBeenCalledWith(0.5);
    expect(registerShading).toHaveBeenCalledWith("sh1", "dict");
    expect(resources.xObjects.get("img1")).toEqual(createPdfRef(5));
    expect(resources.extGStates.get("gs1")).toEqual(createPdfRef(6));
    expect(resources.shadings.get("sh1")).toEqual(createPdfRef(7));
  });
});
