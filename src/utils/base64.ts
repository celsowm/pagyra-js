/**
 * Decode a base64 string into a Uint8Array without relying on Node Buffer.
 */
export function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const c of clean) {
    if (c === "=") break;
    const value = chars.indexOf(c);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(output);
}

/**
 * Encode a Uint8Array to a base64 string without relying on Node Buffer.
 */
export function encodeUint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      output += chars[(buffer >> bits) & 0x3f];
    }
  }

  if (bits > 0) {
    buffer = (buffer << (6 - bits));
    output += chars[buffer & 0x3f];
  }

  while (output.length % 4 !== 0) {
    output += "=";
  }

  return output;
}
