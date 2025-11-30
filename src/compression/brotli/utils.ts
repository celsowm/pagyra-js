/**
 * Utility functions for WOFF 2.0 Brotli operations
 */

/**
 * Calculate 128-bit checksum (for WOFF 2.0 verification)
 */
export function calculateChecksum(data: Uint8Array): number {
  let sum = 0;
  const len = Math.floor(data.length / 4);

  for (let i = 0; i < len; i++) {
    const offset = i * 4;
    sum += (
      (data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3]
    );
    sum = sum >>> 0; // Keep as unsigned 32-bit
  }

  return sum;
}

/**
 * Write unsigned base 128 number (UIntBase128)
 */
export function writeUIntBase128(value: number): Uint8Array {
  const result: number[] = [];

  if (value === 0) {
    return new Uint8Array([0]);
  }

  while (value > 0) {
    let byte = value & 0x7f;
    value >>>= 7;

    if (value > 0) {
      byte |= 0x80; // Set continuation bit
    }

    result.push(byte);
  }

  return new Uint8Array(result);
}

/**
 * Read unsigned base 128 number
 */
export function readUIntBase128(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  let byte: number;

  do {
    if (offset + bytesRead >= data.length) {
      throw new Error('Unexpected end of UIntBase128 data');
    }

    byte = data[offset + bytesRead];
    bytesRead++;

    if (shift >= 35) {
      throw new Error('UIntBase128 overflow');
    }

    value |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);

  return { value, bytesRead };
}

/**
 * Write 255UInt16 (WOFF 2.0 specific encoding)
 */
export function write255UInt16(value: number): Uint8Array {
  if (value < 253) {
    return new Uint8Array([value]);
  } else if (value < 508) {
    return new Uint8Array([253, value - 253]);
  } else {
    return new Uint8Array([
      254,
      (value >> 8) & 0xff,
      value & 0xff,
    ]);
  }
}

/**
 * Read 255UInt16
 */
export function read255UInt16(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  const code = data[offset];

  if (code === 253) {
    if (offset + 1 >= data.length) {
      throw new Error('Unexpected end of 255UInt16 data');
    }
    return { value: data[offset + 1] + 253, bytesRead: 2 };
  } else if (code === 254) {
    if (offset + 2 >= data.length) {
      throw new Error('Unexpected end of 255UInt16 data');
    }
    return {
      value: (data[offset + 1] << 8) | data[offset + 2],
      bytesRead: 3
    };
  } else if (code === 255) {
    throw new Error('Invalid 255UInt16 code');
  } else {
    return { value: code, bytesRead: 1 };
  }
}

/**
 * Concatenate Uint8Arrays
 */
export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
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
 * Convert to Uint8Array
 */
export function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  return new Uint8Array(data);
}

/**
 * Pad data to 4-byte boundary
 */
export function padTo4Bytes(data: Uint8Array): Uint8Array {
  const padding = (4 - (data.length % 4)) % 4;
  if (padding === 0) return data;

  const padded = new Uint8Array(data.length + padding);
  padded.set(data);
  return padded;
}
