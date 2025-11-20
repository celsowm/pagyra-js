export namespace woff2 {
  export const kWoff2Signature: number;      // 'wOF2'
  export const kWoff2FlagsTransform: number; // 1 << 8
  export const kTtcFontFlavor: number;       // 'ttcf'

  export const kSfntHeaderSize: number;
  export const kSfntEntrySize: number;

  export interface Point {
    x: number;
    y: number;
    on_curve: boolean;
  }

  export interface Table {
    tag: number;
    flags: number;
    src_offset: number;
    src_length: number;
    transform_length: number;
    dst_offset: number;
    dst_length: number;
    dst_data: Uint8Array | null;
  }

  /** TTC collection header size (CollectionHeaderSize in C++). */
  export function CollectionHeaderSize(
    headerVersion: number,
    numFonts: number,
  ): number;

  /** Compute uint32 sum (ComputeULongSum in C++). */
  export function ComputeULongSum(
    buf: Uint8Array,
    size: number,
  ): number;
}
