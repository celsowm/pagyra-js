import { parseTtfBuffer } from './ttf-lite.js';
import { parseWoff } from './woff-parser.js';
import { parseWoff2 } from './woff2-parser.js';
import { TtfFontMetrics } from '../../types/fonts.js';

function getFontSignature(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  return view.getUint32(0);
}

export function parseFont(buffer: ArrayBuffer): TtfFontMetrics {
  const signature = getFontSignature(buffer);

  let sfntBuffer: ArrayBuffer;

  switch (signature) {
    case 0x774f4646: // 'wOFF'
      sfntBuffer = parseWoff(buffer);
      break;
    case 0x774f4632: // 'wOF2'
      sfntBuffer = parseWoff2(buffer);
      break;
    default:
      // Assuming TTF/OTF if signature is not WOFF or WOFF2
      sfntBuffer = buffer;
      break;
  }

  return parseTtfBuffer(sfntBuffer);
}
