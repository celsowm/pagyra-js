/**
 * Environment abstractions to decouple platform-specific I/O from core logic.
 * Node and browser builds should provide their own implementations.
 */
export interface ResourceLoader {
  /**
   * Load a binary resource (font, image, etc.) from a URL or path.
   */
  load(source: string): Promise<ArrayBuffer>;
}

export interface Compression {
  /**
   * Inflate raw deflate-compressed data (no zlib headers).
   */
  inflateRaw(data: Uint8Array): Promise<Uint8Array>;
}

export interface Environment {
  readonly loader: ResourceLoader;
  readonly compression: Compression;
  /**
   * Resolve a local reference (path or URL-like) relative to a base.
   * Implementations may throw if local resolution isn't supported (e.g., browser).
   */
  resolveLocal?(source: string, base?: string): string;
  /**
   * Monotonic-ish clock for timing/debug (milliseconds).
   */
  now(): number;
  /**
   * Get an environment variable.
   */
  getEnv(name: string): string | undefined;
}
