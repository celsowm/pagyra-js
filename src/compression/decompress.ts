/**
 * Shared async decompression helpers backed by native/browser primitives.
 * These wrap our WOFF-specific compression modules to avoid external deps.
 */
import { WOFF2Brotli } from "./brotli/index.js";
import { WOFFDeflate } from "./deflate.js";

export type AsyncDecompressFn = (data: Uint8Array) => Promise<Uint8Array>;

export const decompressWoff2: AsyncDecompressFn = async (data) => {
  return WOFF2Brotli.decompress(data);
};

export const decompressWoffZlib: AsyncDecompressFn = async (data) => {
  return WOFFDeflate.decompress(data);
};
