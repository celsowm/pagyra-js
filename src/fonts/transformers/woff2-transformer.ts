// This file will contain the logic for reversing WOFF2 table transformations.
// The primary focus will be on the 'glyf' and 'loca' tables.
// The implementation will be ported from the C++ source in _ext/woff2_original_cpp/src/woff2_dec.cc.
import { BitReader } from '../../compression/brotli/bit-reader';

interface Point {
  x: number;
  y: number;
  onCurve: boolean;
}

function withSign(flag: number, baseval: number): number {
  return (flag & 1) ? baseval : -baseval;
}

function tripletDecode(flagsIn: Uint8Array, inStream: BitReader, nPoints: number): Point[] {
  const points: Point[] = [];
  let x = 0;
  let y = 0;

  for (let i = 0; i < nPoints; i++) {
    const flag = flagsIn[i];
    const onCurve = !(flag >> 7);
    const flagBits = flag & 0x7f;
    let dx: number, dy: number;

    if (flagBits < 84) {
      const b0 = flagBits - 20;
      const b1 = inStream.readBits(8);
      dx = withSign(flag, 1 + (b0 & 0x30) + (b1 >> 4));
      dy = withSign(flag >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f));
    } else if (flagBits < 120) {
      const b0 = flagBits - 84;
      dx = withSign(flag, 1 + ((b0 / 12) << 8) + inStream.readBits(8));
      dy = withSign(flag >> 1, 1 + (((b0 % 12) >> 2) << 8) + inStream.readBits(8));
    } else if (flagBits < 124) {
      const b2 = inStream.readBits(8);
      dx = withSign(flag, (inStream.readBits(8) << 4) + (b2 >> 4));
      dy = withSign(flag >> 1, ((b2 & 0x0f) << 8) + inStream.readBits(8));
    } else {
      dx = withSign(flag, (inStream.readBits(8) << 8) | inStream.readBits(8));
      dy = withSign(flag >> 1, (inStream.readBits(8) << 8) | inStream.readBits(8));
    }

    x += dx;
    y += dy;
    points.push({ x, y, onCurve });
  }

  return points;
}


export function reconstructGlyfTable(transformedData: Uint8Array, locaData: Uint8Array): { glyf: Uint8Array, loca: Uint8Array } {
  const reader = new BitReader(transformedData);
  const version = reader.readBits(16);
  const numGlyphs = reader.readBits(16);
  const indexFormat = reader.readBits(16);

  // This is a simplified placeholder for the full 'glyf' table reconstruction.
  // A complete implementation requires porting the entire ReconstructGlyf function,
  // which includes handling composite glyphs, instructions, and substreams.
  const glyfTable = new Uint8Array(0);
  const locaTable = new Uint8Array((numGlyphs + 1) * (indexFormat === 0 ? 2 : 4));

  return { glyf: glyfTable, loca: locaTable };
}
