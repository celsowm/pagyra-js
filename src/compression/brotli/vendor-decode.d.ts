// Type declarations for brotli decode vendor module
// Using absolute module path to avoid TS2436 error

declare module "#compression/brotli/vendor/decode.js" {
  export function BrotliDecompress(input: Uint8Array, output?: Uint8Array): Uint8Array;
  export function BrotliDecompressBuffer(buffer: Uint8Array, outputSize?: number): Uint8Array;
}
