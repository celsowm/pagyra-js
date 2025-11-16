import type { FontResource } from "../font/font-registry.js";
import { encodeAndEscapePdfText, escapePdfLiteral, type PdfEncodingScheme } from "../utils/encoding.js";

export interface TextEncodedPayload {
  readonly encoded: string;
  readonly scheme: PdfEncodingScheme;
}

export function encodeTextPayload(text: string, font: FontResource): TextEncodedPayload {
  if (font.isBase14) {
    return { encoded: encodeAndEscapePdfText(text, "WinAnsi"), scheme: "WinAnsi" };
  }
  return { encoded: encodeIdentityText(text, font), scheme: "Identity-H" };
}

function encodeIdentityText(text: string, font: FontResource): string {
  const metrics = font.metrics;
  if (!metrics) {
    return encodeAndEscapePdfText(text, "WinAnsi");
  }
  let encoded = "";
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    const glyphId = metrics.cmap.getGlyphId(codePoint);
    encoded += String.fromCharCode((glyphId >> 8) & 0xff, glyphId & 0xff);
  }
  return escapePdfLiteral(encoded);
}
