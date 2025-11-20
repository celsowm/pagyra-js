export namespace woff2 {
  export const kDefaultMaxSize: number;

  export interface WOFF2Out {
    Write(buf: ArrayBufferView | ArrayBuffer, n: number): boolean;
    WriteOffset(
      buf: ArrayBufferView | ArrayBuffer,
      offset: number,
      n: number,
    ): boolean;
    Size(): number;
  }

  /** String-based output (equivalent to WOFF2StringOut). */
  export class WOFF2StringOut implements WOFF2Out {
    constructor(buf: string);
    Write(buf: ArrayBufferView | ArrayBuffer, n: number): boolean;
    WriteOffset(
      buf: ArrayBufferView | ArrayBuffer,
      offset: number,
      n: number,
    ): boolean;
    Size(): number;
    MaxSize(): number;
    SetMaxSize(maxSize: number): void;
  }

  /** Memory buffer output (equivalent to WOFF2MemoryOut). */
  export class WOFF2MemoryOut implements WOFF2Out {
    constructor(buf: Uint8Array);
    Write(buf: ArrayBufferView | ArrayBuffer, n: number): boolean;
    WriteOffset(
      buf: ArrayBufferView | ArrayBuffer,
      offset: number,
      n: number,
    ): boolean;
    Size(): number;
  }
}
