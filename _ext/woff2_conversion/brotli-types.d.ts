export type BrotliBool = boolean;
export const BROTLI_TRUE: BrotliBool;
export const BROTLI_FALSE: BrotliBool;

export function TO_BROTLI_BOOL(x: unknown): BrotliBool;

/** Equivalent to BROTLI_MAKE_UINT64_T (high << 32 | low). */
export function BROTLI_MAKE_UINT64_T(high: number, low: number): bigint;

/** Approximate limits from C headers. */
export const BROTLI_UINT32_MAX: number;
export const BROTLI_SIZE_MAX: number;

export type BrotliAllocFunc = (opaque: unknown, size: number) => Uint8Array | null;
export type BrotliFreeFunc = (opaque: unknown, address: Uint8Array | null) => void;
