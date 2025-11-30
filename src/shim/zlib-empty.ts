export function inflateSync(_data: Uint8Array): never {
  throw new Error("inflateSync is not available in browser bundle");
}

export function brotliDecompressSync(_data: Uint8Array): never {
  throw new Error("brotliDecompressSync is not available in browser bundle");
}

export default {};
