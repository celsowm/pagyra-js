import type { FontFormat } from './types.js';

export function detectFontFormat(fontData: Uint8Array): FontFormat | null {
  if (fontData.length < 4) {
    return null;
  }

  // Read the first 4 bytes as signature
  const signature = String.fromCharCode(...fontData.slice(0, 4));

  switch (signature) {
    case 'wOFF':
      return 'woff';
    case 'wOF2':
      return 'woff2';
    case '\x00\x01\x00\x00': // TTF/OTF signature
    case 'OTTO': // OTF signature
      // For simplicity, we'll treat both TTF and OTF as 'ttf' for now
      // Later we can differentiate if needed
      return fontData[0] === 0 && fontData[1] === 1 ? 'ttf' : 'otf';
    default:
      return null;
  }
}

export function isSupportedFontFormat(fontData: Uint8Array): boolean {
  return detectFontFormat(fontData) !== null;
}
