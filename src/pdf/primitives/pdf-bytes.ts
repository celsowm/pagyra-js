/**
 * Helpers for working with PDF byte data without relying on Node's Buffer.
 * These utilities keep encoding predictable across Node and browser builds.
 */

/**
 * Encode a "binary" string (latin1) into a Uint8Array.
 * Characters beyond 0xFF are truncated to preserve byte-for-byte output.
 */
export function encodeBinaryString(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    out[i] = value.charCodeAt(i) & 0xff;
  }
  return out;
}

/**
 * Encode a UTF-8 string into bytes. Use this for plain text sections; avoids Buffer.
 */
const utf8Encoder = new TextEncoder();
export function encodeText(value: string): Uint8Array {
  return utf8Encoder.encode(value);
}

/**
 * Concatenate byte chunks into a single Uint8Array.
 */
export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
