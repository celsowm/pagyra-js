import type { woff2 as Woff2NS } from "./woff2-output";

export namespace woff2 {
  /** Final TTF size for a given WOFF2 buffer. */
  export function ComputeWOFF2FinalSize(
    data: Uint8Array,
    length?: number,
  ): number;

  /**
   * Convert WOFF2 to TTF into a pre-allocated buffer.
   *
   * - result: output buffer (TTF)
   * - resultLength: size of result buffer
   * - data/length: WOFF2 input
   */
  export function ConvertWOFF2ToTTF(
    result: Uint8Array,
    resultLength: number,
    data: Uint8Array,
    length?: number,
  ): boolean;

  /**
   * Version with WOFF2Out callback.
   */
  export function ConvertWOFF2ToTTFWithOut(
    data: Uint8Array,
    length: number,
    out: Woff2NS.WOFF2Out,
  ): boolean;
}
