import type { BrotliAllocFunc, BrotliFreeFunc, BrotliBool } from "./brotli-types";
import type { BrotliSharedDictionaryType } from "./brotli-shared-dictionary";

export interface BrotliDecoderState {} // opaque

export enum BrotliDecoderResult {
  BROTLI_DECODER_RESULT_ERROR = 0,
  BROTLI_DECODER_RESULT_SUCCESS = 1,
  BROTLI_DECODER_RESULT_NEEDS_MORE_INPUT = 2,
  BROTLI_DECODER_RESULT_NEEDS_MORE_OUTPUT = 3,
}

export enum BrotliDecoderErrorCode {
  BROTLI_DECODER_NO_ERROR = 0,
  BROTLI_DECODER_SUCCESS = 1,
  BROTLI_DECODER_NEEDS_MORE_INPUT = 2,
  BROTLI_DECODER_NEEDS_MORE_OUTPUT = 3,

  BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_NIBBLE = -1,
  BROTLI_DECODER_ERROR_FORMAT_RESERVED = -2,
  BROTLI_DECODER_ERROR_FORMAT_EXUBERANT_META_NIBBLE = -3,
  BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_ALPHABET = -4,
  BROTLI_DECODER_ERROR_FORMAT_SIMPLE_HUFFMAN_SAME = -5,
  BROTLI_DECODER_ERROR_FORMAT_CL_SPACE = -6,
  BROTLI_DECODER_ERROR_FORMAT_HUFFMAN_SPACE = -7,
  BROTLI_DECODER_ERROR_FORMAT_CONTEXT_MAP_REPEAT = -8,
  BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_1 = -9,
  BROTLI_DECODER_ERROR_FORMAT_BLOCK_LENGTH_2 = -10,
  BROTLI_DECODER_ERROR_FORMAT_TRANSFORM = -11,
  BROTLI_DECODER_ERROR_FORMAT_DICTIONARY = -12,
  BROTLI_DECODER_ERROR_FORMAT_WINDOW_BITS = -13,
  BROTLI_DECODER_ERROR_FORMAT_PADDING_1 = -14,
  BROTLI_DECODER_ERROR_FORMAT_PADDING_2 = -15,
  BROTLI_DECODER_ERROR_FORMAT_DISTANCE = -16,

  BROTLI_DECODER_ERROR_COMPOUND_DICTIONARY = -18,
  BROTLI_DECODER_ERROR_DICTIONARY_NOT_SET = -19,
  BROTLI_DECODER_ERROR_INVALID_ARGUMENTS = -20,

  BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MODES = -21,
  BROTLI_DECODER_ERROR_ALLOC_TREE_GROUPS = -22,
  BROTLI_DECODER_ERROR_ALLOC_CONTEXT_MAP = -25,
  BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_1 = -26,
  BROTLI_DECODER_ERROR_ALLOC_RING_BUFFER_2 = -27,
  BROTLI_DECODER_ERROR_ALLOC_BLOCK_TYPE_TREES = -30,

  BROTLI_DECODER_ERROR_UNREACHABLE = -31,
}

export const BROTLI_LAST_ERROR_CODE: BrotliDecoderErrorCode;

export enum BrotliDecoderParameter {
  BROTLI_DECODER_PARAM_DISABLE_RING_BUFFER_REALLOCATION = 0,
  BROTLI_DECODER_PARAM_LARGE_WINDOW = 1,
}

export declare function BrotliDecoderSetParameter(
  state: BrotliDecoderState,
  param: BrotliDecoderParameter,
  value: number,
): BrotliBool;

export declare function BrotliDecoderAttachDictionary(
  state: BrotliDecoderState,
  type: BrotliSharedDictionaryType,
  dataSize: number,
  data: Uint8Array,
): BrotliBool;

export declare function BrotliDecoderCreateInstance(
  allocFunc: BrotliAllocFunc | null,
  freeFunc: BrotliFreeFunc | null,
  opaque: unknown,
): BrotliDecoderState;

export declare function BrotliDecoderDestroyInstance(
  state: BrotliDecoderState | null,
): void;

export declare function BrotliDecoderDecompress(
  encodedSize: number,
  encodedBuffer: Uint8Array,
  decodedSizeRef: { value: number },
  decodedBuffer: Uint8Array,
): BrotliDecoderResult;

export declare function BrotliDecoderDecompressStream(
  state: BrotliDecoderState,
  availableIn: { value: number },
  nextIn: { value: Uint8Array | null },
  availableOut: { value: number },
  nextOut: { value: Uint8Array | null },
  totalOut: { value: number },
): BrotliDecoderResult;

export declare function BrotliDecoderHasMoreOutput(
  state: BrotliDecoderState,
): BrotliBool;

export declare function BrotliDecoderTakeOutput(
  state: BrotliDecoderState,
  sizeOut: { value: number },
): Uint8Array | null;

export declare function BrotliDecoderIsUsed(
  state: BrotliDecoderState,
): BrotliBool;

export declare function BrotliDecoderIsFinished(
  state: BrotliDecoderState,
): BrotliBool;

export declare function BrotliDecoderGetErrorCode(
  state: BrotliDecoderState,
): BrotliDecoderErrorCode;

export declare function BrotliDecoderErrorString(
  code: BrotliDecoderErrorCode,
): string;

export declare function BrotliDecoderVersion(): number;

export type BrotliDecoderMetadataStartFunc = (
  opaque: unknown,
  size: number,
) => void;

export type BrotliDecoderMetadataChunkFunc = (
  opaque: unknown,
  data: Uint8Array,
  size: number,
) => void;

export declare function BrotliDecoderSetMetadataCallbacks(
  state: BrotliDecoderState,
  startFunc: BrotliDecoderMetadataStartFunc | null,
  chunkFunc: BrotliDecoderMetadataChunkFunc | null,
  opaque: unknown,
): void;
