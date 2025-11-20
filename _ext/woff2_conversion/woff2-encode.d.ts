export namespace woff2 {
  export class WOFF2Params {
    extended_metadata: string;
    brotli_quality: number;
    allow_transforms: boolean;
  }

  /**
   * Maximum expected compressed size for given TTF and metadata.
   */
  export function MaxWOFF2CompressedSize(
    data: Uint8Array,
    length?: number,
    extendedMetadata?: string,
  ): number;

  /**
   * Convert TTF to WOFF2.
   *
   * - data/length: input TTF
   * - result/resultLengthRef: output buffer + written length
   * - params: compression params (Brotli, transforms, etc.)
   */
  export function ConvertTTFToWOFF2(
    data: Uint8Array,
    length: number,
    result: Uint8Array,
    resultLengthRef: { value: number },
    params?: WOFF2Params,
  ): boolean;
}
