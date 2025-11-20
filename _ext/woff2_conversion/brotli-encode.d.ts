import type { BrotliAllocFunc, BrotliFreeFunc, BrotliBool } from "./brotli-types";
import type { BrotliSharedDictionaryType } from "./brotli-shared-dictionary";

export const BROTLI_MIN_WINDOW_BITS = 10;
export const BROTLI_MAX_WINDOW_BITS = 24;
export const BROTLI_LARGE_MAX_WINDOW_BITS = 30;

export const BROTLI_MIN_INPUT_BLOCK_BITS = 16;
export const BROTLI_MAX_INPUT_BLOCK_BITS = 24;

export const BROTLI_MIN_QUALITY = 0;
export const BROTLI_MAX_QUALITY = 11;

export enum BrotliEncoderMode {
  BROTLI_MODE_GENERIC = 0,
  BROTLI_MODE_TEXT = 1,
  BROTLI_MODE_FONT = 2,
}

export const BROTLI_DEFAULT_QUALITY: number;
export const BROTLI_DEFAULT_WINDOW: number;
export const BROTLI_DEFAULT_MODE: BrotliEncoderMode;

export enum BrotliEncoderOperation {
  BROTLI_OPERATION_PROCESS = 0,
  BROTLI_OPERATION_FLUSH = 1,
  BROTLI_OPERATION_FINISH = 2,
  BROTLI_OPERATION_EMIT_METADATA = 3,
}

export enum BrotliEncoderParameter {
  BROTLI_PARAM_MODE = 0,
  BROTLI_PARAM_QUALITY = 1,
  BROTLI_PARAM_LGWIN = 2,
  BROTLI_PARAM_LGBLOCK = 3,
  BROTLI_PARAM_DISABLE_LITERAL_CONTEXT_MODELING = 4,
  BROTLI_PARAM_SIZE_HINT = 5,
  BROTLI_PARAM_LARGE_WINDOW = 6,
  BROTLI_PARAM_NPOSTFIX = 7,
  BROTLI_PARAM_NDIRECT = 8,
  BROTLI_PARAM_STREAM_OFFSET = 9,
}

export interface BrotliEncoderState {} // opaque
export interface BrotliEncoderPreparedDictionary {} // opaque

export declare function BrotliEncoderSetParameter(
  state: BrotliEncoderState,
  param: BrotliEncoderParameter,
  value: number,
): BrotliBool;

export declare function BrotliEncoderCreateInstance(
  allocFunc: BrotliAllocFunc | null,
  freeFunc: BrotliFreeFunc | null,
  opaque: unknown,
): BrotliEncoderState;

export declare function BrotliEncoderDestroyInstance(
  state: BrotliEncoderState | null,
): void;

export declare function BrotliEncoderPrepareDictionary(
  type: BrotliSharedDictionaryType,
  dataSize: number,
  data: Uint8Array,
  quality: number,
  allocFunc: BrotliAllocFunc | null,
  freeFunc: BrotliFreeFunc | null,
  opaque: unknown,
): BrotliEncoderPreparedDictionary | null;

export declare function BrotliEncoderDestroyPreparedDictionary(
  dict: BrotliEncoderPreparedDictionary | null,
): void;

export declare function BrotliEncoderAttachPreparedDictionary(
  state: BrotliEncoderState,
  dict: BrotliEncoderPreparedDictionary,
): BrotliBool;

export declare function BrotliEncoderMaxCompressedSize(
  inputSize: number,
): number;

export declare function BrotliEncoderCompress(
  quality: number,
  lgwin: number,
  mode: BrotliEncoderMode,
  inputSize: number,
  inputBuffer: Uint8Array,
  encodedSizeRef: { value: number },
  encodedBuffer: Uint8Array,
): BrotliBool;

export declare function BrotliEncoderCompressStream(
  state: BrotliEncoderState,
  op: BrotliEncoderOperation,
  availableIn: { value: number },
  nextIn: { value: Uint8Array | null },
  availableOut: { value: number },
  nextOut: { value: Uint8Array | null },
  totalOut: { value: number },
): BrotliBool;

export declare function BrotliEncoderIsFinished(
  state: BrotliEncoderState,
): BrotliBool;

export declare function BrotliEncoderHasMoreOutput(
  state: BrotliEncoderState,
): BrotliBool;

export declare function BrotliEncoderTakeOutput(
  state: BrotliEncoderState,
  sizeOut: { value: number },
): Uint8Array | null;

export declare function BrotliEncoderEstimatePeakMemoryUsage(
  quality: number,
  lgwin: number,
  inputSize: number,
): number;

export declare function BrotliEncoderGetPreparedDictionarySize(
  dict: BrotliEncoderPreparedDictionary,
): number;

export declare function BrotliEncoderVersion(): number;
