/**
 * Utility functions for DEFLATE operations
 */

/**
 * Read a 16-bit big-endian integer from buffer
 */
export function readUInt16BE(buffer: Uint8Array, offset: number): number {
  return (buffer[offset] << 8) | buffer[offset + 1];
}

/**
 * Write a 32-bit big-endian integer to buffer.
 * No bounds checking is performed for performance reasons.
 */
export function writeUInt32BE(value: number, buffer: Uint8Array, offset: number): void {
  buffer[offset] = (value >>> 24) & 0xff;
  buffer[offset + 1] = (value >>> 16) & 0xff;
  buffer[offset + 2] = (value >>> 8) & 0xff;
  buffer[offset + 3] = value & 0xff;
}

/**
 * Read a 32-bit big-endian integer from buffer.
 */
export function readUInt32BE(buffer: Uint8Array, offset: number): number {
  return (
    ((buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3]) >>> 0 // '>>> 0' ensures result is treated as unsigned
  );
}

/**
 * Write a 16-bit big-endian integer to buffer.
 */
export function writeUInt16BE(value: number, buffer: Uint8Array, offset: number): void {
  buffer[offset] = (value >>> 8) & 0xff;
  buffer[offset + 1] = value & 0xff;
}

/**
 * Concatenate multiple Uint8Arrays.
 */
export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  // Optimization: Check for 0 or 1 array to avoid allocation
  if (arrays.length === 0) return new Uint8Array(0);
  if (arrays.length === 1) return arrays[0];

  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/**
 * Convert ArrayBuffer, DataView, or TypedArray to Uint8Array.
 * This ensures we have a raw byte view regardless of input type.
 */
export function toUint8Array(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}

/**
 * Reads a UBASE128-encoded (Variable Length) number.
 * Returns the number and the number of bytes read.
 * 
 * Note: This implementation assumes "Big Endian" variable length
 * (most significant group first), common in some compression formats.
 */
export function readUBASE128(data: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let bytesRead = 0;
  
  // Limit to 5 bytes (35 bits) to prevent infinite loops on bad data
  // and to stay within JS Safe Integer range.
  for (let i = 0; i < 5; i++) {
    const byte = data[offset + i];
    
    // Use arithmetic (* 128) instead of bitwise (<< 7).
    // Bitwise operators in JS work on 32-bit integers. 
    // 5 bytes can exceed 32 bits (up to 35 bits), which would overflow using '<<'.
    result = (result * 128) + (byte & 0x7f);
    
    bytesRead++;
    
    // If the high bit is NOT set, this is the last byte
    if ((byte & 0x80) === 0) {
      return [result, bytesRead];
    }
  }
  
  throw new Error("Invalid UBASE128 sequence (too long or incomplete)");
}