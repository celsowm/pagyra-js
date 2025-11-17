/**
 * Calculates Adler-32 checksum as required by zlib format
 * Used in WOFF 1.0 for data integrity verification
 */
export class Adler32 {
  private static readonly MOD_ADLER = 65521;

  /**
   * Calculate Adler-32 checksum for the given data
   */
  static calculate(data: Uint8Array): number {
    let a = 1;
    let b = 0;

    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]) % this.MOD_ADLER;
      b = (b + a) % this.MOD_ADLER;
    }

    return (b << 16) | a;
  }

  /**
   * Verify Adler-32 checksum
   */
  static verify(data: Uint8Array, expectedChecksum: number): boolean {
    const calculated = this.calculate(data);
    return calculated === expectedChecksum;
  }

  /**
   * Update running Adler-32 checksum with new data
   */
  static update(adler: number, data: Uint8Array): number {
    let a = adler & 0xffff;
    let b = (adler >>> 16) & 0xffff;

    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]) % this.MOD_ADLER;
      b = (b + a) % this.MOD_ADLER;
    }

    return (b << 16) | a;
  }
}
