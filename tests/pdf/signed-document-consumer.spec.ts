import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { renderHtmlToPdf } from "../../src/html-to-pdf.js";

// Synthetic signatures, generated for this test. No real names or biometric data.
const SIGNATURE_PNG_BASE64 = [
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAAAcCAYAAACeeLqCAAABJ0lEQVR42u2ZOxLDIAxEwQVn4Crcv8hVcoY0pPJMhgCRQMIyWTUu/EP7ljW2fc7Zoa6rAxIAAACgAAAAUAAAANQKMeXPLWohgFJ8ixDuZJBjpDHnnHs9H96iSHcwyHQEleJzm9QQKcSUWwaxDOEYcb9Uk+X5o0KVwp/XtQShdX9P+Rb0K3rO/ZRYoriUE2+U8ySjU8qwZACSDVJBUoQqG+QcrwWBOyYWAGqDFACzYs2IqbGQ4IpOBsAdbE/g0WtJRZUGQAmITQAjg9TM91mnScSmRoRVAUg4pAbgCsfOGkb7wd0FMHLjsikp8UJMWUOI1ixbtVr6AiCdsasbsgSXDUBrhWBZfFNvwrU3SNTiCNplam8H4B+//a8wD/6I7RxBKMwAAED16w0DojXK++QrxwAAAABJRU5ErkJggg==",
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAAAcCAYAAACeeLqCAAABOklEQVR42u1YOxKFMAh8sfAMXiX3L7yKZ7DJq9JoPsgnZDK7paOBsCwgIaX0A/ywIQQgAAQAIAAEACAABAB22I+YpiQgO1ZzcKXgl+4YPH/ESg7d1xlWzfzS3bbZHLNQgofK9iOmXvDFBGhcLDtmRcLTxxEkPAPfUjWrBNUuQS0frcygZA3Hx/s6g9bZkpIjJqBkID+jGKQ4KA1U73srIjjnbpo1rSdvqoOSckSxYVHuuKR2FVCSsjSzNUqVx/uS+HwmgHNwK8Dcy1qXLK9vmwRoOFWTuXZNt2jao9Tz6gHU2ZU7onLPq5Gp2Uy/9AVNuy8F7EdM0kOt/nCl4++ME5TZKkLanEZkH2fU1rY9hADtQGmodJZdlekyblSgPJdpUxOwCiwTSZ2Alff6WlMWaxUB2AAlyBlQgDP+UcpXcO1lHHMAAAAASUVORK5CYII=",
] as const;

const SOURCE_TEXT = "Termo de consentimento 2026 - versão de teste";
const CONTENT_SHA256 = createHash("sha256").update(SOURCE_TEXT, "utf8").digest("hex");

describe("signed-document PDF consumer integration", () => {
  it("preserves two independent signature images, accents, roles, timestamps and a displayed content hash", async () => {
    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'DejaVu Sans', 'Arimo', sans-serif; font-size: 13px">
          <h1>Termo de consentimento</h1>
          <p>Responsável técnico: José Antônio Ferreira</p>
          <p>Contratante: Maria Conceição Araújo</p>
          <section>
            <p>Assinatura de José Antônio Ferreira — Responsável técnico</p>
            <p>05/11/2026 14:30 BRT</p>
            <img alt="Assinatura 1" width="144" height="42"
                 src="data:image/png;base64,${SIGNATURE_PNG_BASE64[0]}" />
          </section>
          <section>
            <p>Assinatura de Maria Conceição Araújo — Contratante</p>
            <p>05/11/2026 14:31 BRT</p>
            <img alt="Assinatura 2" width="144" height="42"
                 src="data:image/png;base64,${SIGNATURE_PNG_BASE64[1]}" />
          </section>
          <p>SHA-256 do conteúdo: ${CONTENT_SHA256}</p>
        </body>
      </html>
    `;

    const pdfBytes = await renderHtmlToPdf({
      html,
      pageWidth: 595,
      pageHeight: 842,
      viewportWidth: 794,
      viewportHeight: 1123,
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
    });

    expect(Buffer.from(pdfBytes).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfBytes.byteLength).toBeGreaterThan(2_000);

    // Two distinct embedded raster images should not disappear or be deduplicated.
    const rawPdf = Buffer.from(pdfBytes).toString("latin1");
    expect((rawPdf.match(/\/Subtype\s*\/Image\b/g) ?? []).length).toBeGreaterThanOrEqual(2);

    const parser = new PDFParse({ data: Buffer.from(pdfBytes) });
    try {
      const extracted = await parser.getText();
      const text = extracted.text.replace(/\s+/g, " ");
      const unwrappedText = extracted.text.replace(/\s+/g, "");

      for (const value of [
        "José Antônio Ferreira",
        "Maria Conceição Araújo",
        "Responsável técnico",
        "Contratante",
        "05/11/2026 14:30",
        "05/11/2026 14:31",
      ]) {
        expect(text).toContain(value);
      }
      // Checks the hash as visible content, not a digital-signature implementation.
      expect(unwrappedText).toContain(CONTENT_SHA256);

      // Unlike merely checking file size, exercise a real PDF rasterizer.
      const screenshots = await parser.getScreenshot({ scale: 1 });
      expect(screenshots.pages).toHaveLength(1);
      const png = Buffer.from(screenshots.pages[0].data);
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      expect(png.byteLength).toBeGreaterThan(1_000);
    } finally {
      await parser.destroy();
    }
  });
});
