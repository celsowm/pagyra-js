/** Build version number used by Brotli (major*1e6 + minor*1e3 + revision). */
export function BROTLI_MAKE_VERSION(
  major: number,
  minor: number,
  revision: number,
): number;

/** Visibility / attribute markers; no effect in TS, kept for parity. */
export const BROTLI_COMMON_API: string;
export const BROTLI_DEC_API: string;
export const BROTLI_ENC_API: string;
export const BROTLI_ENC_EXTRA_API: string;
