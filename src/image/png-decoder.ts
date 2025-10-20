import type { ImageInfo } from "./types.js";

// --- Helper Functions ---

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream('deflate-raw');
    const out = await new Response(new Blob([data as any]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(out);
  } else {
    const { inflateRawSync } = await import('node:zlib');
    return inflateRawSync(data);
  }
}

async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream('deflate');
    const out = await new Response(new Blob([data as any]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(out);
  } else {
    const { inflateSync } = await import('node:zlib');
    return inflateSync(data);
  }
}

function resizeNN(src: Uint8Array, sw: number, sh: number, tw: number, th: number): Uint8Array {
  if (sw === tw && sh === th) return src;
  const dst = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const sy = Math.min(sh - 1, Math.floor(y * sh / th));
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(sw - 1, Math.floor(x * sw / tw));
      const si = (sy * sw + sx) * 4;
      const di = (y * tw + x) * 4;
      dst[di]   = src[si];
      dst[di+1] = src[si+1];
      dst[di+2] = src[si+2];
      dst[di+3] = src[si+3];
    }
  }
  return dst;
}

function extractSampleFromPacked(bytes: Uint8Array, sampleIndex: number, bitDepth: 1|2|4): number {
  const bitsPerByte = 8;
  const samplesPerByte = bitsPerByte / bitDepth;
  const byteIndex = Math.floor(sampleIndex / samplesPerByte);
  const insideByteIndex = sampleIndex % samplesPerByte;
  const shift = bitsPerByte - bitDepth * (insideByteIndex + 1);
  const mask = (1 << bitDepth) - 1;
  return (bytes[byteIndex] >> shift) & mask;
}

function scaleTo8bit(v:number, bitDepth:1|2|4): number {
  const max = (1 << bitDepth) - 1;
  return Math.round((v / max) * 255);
}

/**
 * PNG decoder that extracts metadata and decodes the image data.
 */
export class PngDecoder {
  private static readonly PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  public static async decode(
    buffer: ArrayBuffer,
    options: { maxWidth?: number; maxHeight?: number; scale?: number } = {},
  ): Promise<ImageInfo> {
    const view = new DataView(buffer);

    for (let i = 0; i < this.PNG_SIGNATURE.length; i++) {
      if (view.getUint8(i) !== this.PNG_SIGNATURE[i]) {
        throw new Error("Invalid PNG: missing signature");
      }
    }

    let offset = 8;
    const idatData: Uint8Array[] = [];
    let width = 0, height = 0, bitDepth = 0, colorType = 0, interlaceMethod = 0;
    let palette: Uint8Array | null = null;
    let trns: Uint8Array | null = null;
    let sawIDAT = false, sawIEND = false;

    while (offset < buffer.byteLength) {
      const length = view.getUint32(offset, false);
      const type = String.fromCharCode(
        view.getUint8(offset + 4), view.getUint8(offset + 5),
        view.getUint8(offset + 6), view.getUint8(offset + 7)
      );
      const chunkDataOffset = offset + 8;

      if (offset + 12 + length > buffer.byteLength) {
        throw new Error(`Corrupt PNG: chunk ${type} overruns file`);
      }

      if (type === 'IHDR') {
        width = view.getUint32(chunkDataOffset, false);
        height = view.getUint32(chunkDataOffset + 4, false);
        bitDepth = view.getUint8(chunkDataOffset + 8);
        colorType = view.getUint8(chunkDataOffset + 9);
        const compressionMethod = view.getUint8(chunkDataOffset + 10);
        const filterMethod = view.getUint8(chunkDataOffset + 11);
        interlaceMethod = view.getUint8(chunkDataOffset + 12);
        if (compressionMethod !== 0) throw new Error("Unsupported PNG compression method");
        if (filterMethod !== 0) throw new Error("Unsupported PNG filter method");
      } else if (type === 'PLTE') {
        if (sawIDAT) throw new Error("Invalid PNG: PLTE after IDAT");
        if (length % 3 !== 0) throw new Error("Invalid PLTE length");
        if (length / 3 > 256) throw new Error("Invalid PLTE: >256 entries");
        palette = new Uint8Array(buffer, chunkDataOffset, length);
      } else if (type === 'tRNS') {
        if (colorType === 3 && palette && length > palette.length / 3) {
          throw new Error("Invalid tRNS length for indexed PNG");
        }
        trns = new Uint8Array(buffer, chunkDataOffset, length);
      } else if (type === 'IDAT') {
        sawIDAT = true;
        idatData.push(new Uint8Array(buffer, chunkDataOffset, length));
      } else if (type === 'IEND') {
        sawIEND = true;
        offset += 12 + length;
        break;
      }
      offset += 12 + length;
    }

    if (!sawIEND) throw new Error("Invalid PNG: missing IEND chunk");
    if (!sawIDAT) throw new Error("Invalid PNG: missing IDAT chunk");
    if (colorType === 3 && !palette) throw new Error("Indexed PNG missing PLTE chunk");
    if (width === 0 || height === 0) throw new Error("Invalid PNG: missing IHDR chunk");
    if (interlaceMethod !== 0) throw new Error("Interlaced PNGs are not supported");

    const totalIdatLength = idatData.reduce((acc, val) => acc + val.length, 0);
    const compressedData = new Uint8Array(totalIdatLength);
    let currentOffset = 0;
    for (const chunk of idatData) {
      compressedData.set(chunk, currentOffset);
      currentOffset += chunk.length;
    }

    const isLikelyZlib = (compressedData[0] & 0x0F) === 0x08;
    const decompressed = isLikelyZlib
      ? await inflateZlib(compressedData)
      : await inflateRaw(compressedData.slice(2, -4));

    let channels = 0;
    switch (colorType) {
      case 0: channels = 1; break;
      case 2: channels = 3; break;
      case 3: channels = 1; break;
      case 4: channels = 2; break;
      case 6: channels = 4; break;
      default: throw new Error(`Invalid colorType: ${colorType}`);
    }

    const bitsPerPixel = bitDepth * channels;
    const rowBytes = Math.ceil((bitsPerPixel * width) / 8);
    const pixelData = new Uint8Array(width * height * 4);
    const bpp = Math.max(1, Math.ceil(bitDepth * channels / 8));

    let prevRecon = new Uint8Array(rowBytes);
    let decompressedOffset = 0;

    const paeth = (a:number,b:number,c:number) => {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
    };

    for (let y = 0; y < height; y++) {
        const filterType = decompressed[decompressedOffset++];
        const scanline = decompressed.subarray(decompressedOffset, decompressedOffset + rowBytes);
        decompressedOffset += rowBytes;

        let recon = new Uint8Array(rowBytes);
        for (let x = 0; x < rowBytes; x++) {
            const a = x >= bpp ? recon[x - bpp] : 0;
            const b = prevRecon[x];
            const c = x >= bpp ? prevRecon[x - bpp] : 0;
            let val = 0;
            switch (filterType) {
                case 0: val = scanline[x]; break;
                case 1: val = (scanline[x] + a) & 0xFF; break;
                case 2: val = (scanline[x] + b) & 0xFF; break;
                case 3: val = (scanline[x] + ((a + b) >>> 1)) & 0xFF; break;
                case 4: val = (scanline[x] + paeth(a, b, c)) & 0xFF; break;
                default: throw new Error(`Invalid PNG filter: ${filterType}`);
            }
            recon[x] = val;
        }

        // Convert recon to RGBA and apply transparency
        if (colorType === 6) { // RGBA
            if (bitDepth === 8) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const reconIdx = x * 4;
                    pixelData.set(recon.subarray(reconIdx, reconIdx + 4), idx);
                }
            } else if (bitDepth === 16) {
                for (let x = 0; x < width; x++) {
                    const src = x * 8;
                    const dst = (y * width + x) * 4;
                    pixelData[dst]   = recon[src];
                    pixelData[dst+1] = recon[src+2];
                    pixelData[dst+2] = recon[src+4];
                    pixelData[dst+3] = recon[src+6];
                }
            }
        } else if (colorType === 2) { // RGB
            const applyTrns = (r:number, g:number, b:number) => {
                if (!trns) return 255;
                return (r === trns[0] && g === trns[2] && b === trns[4]) ? 0 : 255;
            };
            if (bitDepth === 8) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const reconIdx = x * 3;
                    const r = recon[reconIdx], g = recon[reconIdx + 1], b = recon[reconIdx + 2];
                    pixelData[idx] = r; pixelData[idx + 1] = g; pixelData[idx + 2] = b;
                    pixelData[idx + 3] = applyTrns(r, g, b);
                }
            } else if (bitDepth === 16) {
                for (let x = 0; x < width; x++) {
                    const src = x * 6;
                    const dst = (y * width + x) * 4;
                    const r = recon[src], g = recon[src+2], b = recon[src+4];
                    pixelData[dst] = r; pixelData[dst+1] = g; pixelData[dst+2] = b;
                    pixelData[dst+3] = applyTrns(r, g, b);
                }
            }
        } else if (colorType === 3) { // Indexed
            for (let x = 0; x < width; x++) {
                const byteIndex = (bitDepth === 8) ? recon[x] : extractSampleFromPacked(recon, x, bitDepth as 1|2|4);
                const p = byteIndex * 3;
                const dst = (y * width + x) * 4;
                pixelData[dst]     = palette![p];
                pixelData[dst + 1] = palette![p + 1];
                pixelData[dst + 2] = palette![p + 2];
                pixelData[dst + 3] = trns && byteIndex < trns.length ? trns[byteIndex] : 255;
            }
        } else if (colorType === 0) { // Grayscale
            const applyTrns = (g: number) => (!trns || g !== trns[0]) ? 255 : 0;
            if (bitDepth === 8) {
                for (let x = 0; x < width; x++) {
                    const g = recon[x];
                    const dst = ((y * width) + x) * 4;
                    pixelData[dst] = pixelData[dst+1] = pixelData[dst+2] = g;
                    pixelData[dst+3] = applyTrns(g);
                }
            } else if (bitDepth === 1 || bitDepth === 2 || bitDepth === 4) {
                for (let x = 0; x < width; x++) {
                    const s = extractSampleFromPacked(recon, x, bitDepth as 1|2|4);
                    const g = scaleTo8bit(s, bitDepth as 1|2|4);
                    const dst = ((y * width) + x) * 4;
                    pixelData[dst] = pixelData[dst+1] = pixelData[dst+2] = g;
                    pixelData[dst+3] = applyTrns(g);
                }
            } else if (bitDepth === 16) {
                for (let x = 0; x < width; x++) {
                    const g = recon[x*2];
                    const dst = ((y * width) + x) * 4;
                    pixelData[dst] = pixelData[dst+1] = pixelData[dst+2] = g;
                    pixelData[dst+3] = applyTrns(g);
                }
            }
        } else if (colorType === 4) { // Grayscale + Alpha
            if (bitDepth === 8) {
                for (let x = 0; x < width; x++) {
                    const dst = ((y * width) + x) * 4;
                    const g = recon[x*2], a = recon[x*2+1];
                    pixelData[dst] = pixelData[dst+1] = pixelData[dst+2] = g;
                    pixelData[dst+3] = a;
                }
            } else if (bitDepth === 16) {
                for (let x = 0; x < width; x++) {
                    const dst = ((y * width) + x) * 4;
                    const g = recon[x*4], a = recon[x*4 + 2];
                    pixelData[dst] = pixelData[dst+1] = pixelData[dst+2] = g;
                    pixelData[dst+3] = a;
                }
            }
        }
        prevRecon = recon;
    }

    let targetWidth = width;
    let targetHeight = height;

    if (options.scale && options.scale > 0) {
      targetWidth = Math.max(1, Math.round(width * options.scale));
      targetHeight = Math.max(1, Math.round(height * options.scale));
    } else if (options.maxWidth || options.maxHeight) {
      const scale = Math.min(
        options.maxWidth ? options.maxWidth / width : 1,
        options.maxHeight ? options.maxHeight / height : 1,
      );
      if (scale > 0 && scale < 1) {
        targetWidth = Math.max(1, Math.round(width * scale));
        targetHeight = Math.max(1, Math.round(height * scale));
      }
    }

    const finalData = resizeNN(pixelData, width, height, targetWidth, targetHeight);

    return {
      width: targetWidth,
      height: targetHeight,
      format: "png",
      channels: 4,
      bitsPerChannel: 8,
      data: finalData.buffer as ArrayBuffer,
    };
  }
}
