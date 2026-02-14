import { describe, it, expect } from "vitest";
import { renderHtmlToPdfBase64 } from "../../src/html-to-pdf.js";
import { decodeBase64ToUint8Array } from "../../src/utils/base64.js";

describe("renderHtmlToPdfBase64", () => {
    it("should return a valid base64 string representing a PDF", async () => {
        const html = "<html><body><h1>Hello Base64</h1></body></html>";
        const base64Pdf = await renderHtmlToPdfBase64({ html });

        expect(typeof base64Pdf).toBe("string");
        expect(base64Pdf.length).toBeGreaterThan(0);

        // Verify it starts with PDF signature (JVBERi0... corresponds to %PDF-)
        expect(base64Pdf.startsWith("JVBERi0")).toBe(true);

        // Decode back and check header
        const pdfBytes = decodeBase64ToUint8Array(base64Pdf);
        const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
        expect(header).toBe("%PDF-");
    });
});
