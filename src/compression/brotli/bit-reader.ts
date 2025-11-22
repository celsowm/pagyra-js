export class BitReader {
  private buffer: Uint8Array;
  private bytePos: number;
  private bitPos: number;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.bytePos = 0;
    this.bitPos = 0;
  }

  readBit(): number {
    if (this.bytePos >= this.buffer.length) {
      throw new Error('Reading past end of buffer');
    }
    const bit = (this.buffer[this.bytePos] >> this.bitPos) & 1;
    this.bitPos++;
    if (this.bitPos === 8) {
      this.bitPos = 0;
      this.bytePos++;
    }
    return bit;
  }

  readBits(n: number): number {
    let result = 0;
    for (let i = 0; i < n; i++) {
      result |= this.readBit() << i;
    }
    return result;
  }

  byteAlign() {
    if (this.bitPos !== 0) {
      this.bitPos = 0;
      this.bytePos++;
    }
  }
}
