import type { BrotliAllocFunc, BrotliFreeFunc, BrotliBool } from "./brotli-types";

export enum BrotliSharedDictionaryType {
  BROTLI_SHARED_DICTIONARY_RAW = 0,
  BROTLI_SHARED_DICTIONARY_SERIALIZED = 1,
}

/** Opaque handle (BrotliSharedDictionary in C). */
export interface BrotliSharedDictionary {}

export declare function BrotliSharedDictionaryCreateInstance(
  allocFunc: BrotliAllocFunc | null,
  freeFunc: BrotliFreeFunc | null,
  opaque: unknown,
): BrotliSharedDictionary;

export declare function BrotliSharedDictionaryDestroyInstance(
  dict: BrotliSharedDictionary | null,
): void;

export declare function BrotliSharedDictionaryAttach(
  dict: BrotliSharedDictionary,
  type: BrotliSharedDictionaryType,
  data: Uint8Array,
): BrotliBool;
