import type { FontResource } from "../font/font-registry.js";
import { encodeAndEscapePdfText, escapePdfLiteral, type PdfEncodingScheme } from "../utils/encoding.js";
import { log } from "../../logging/debug.js";

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
  const samples: Array<{ char: string, codePoint: number, gid: number }> = [];
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    const glyphId = metrics.cmap.getGlyphId(codePoint);
    if (samples.length < 10) {
      samples.push({ char, codePoint, gid: glyphId });
    }
    // For Identity-H encoding, write the Unicode code point, not the glyph ID
    // The font's internal cmap will map Unicode -> Glyph ID during rendering
    encoded += String.fromCharCode((codePoint >> 8) & 0xff, codePoint & 0xff);
  }
  if (samples.length > 0) {
    log("encoding", "debug", "Identity-H encoding samples", { font: font.baseFont, samples });
  }
  return escapePdfLiteral(encoded);
}
