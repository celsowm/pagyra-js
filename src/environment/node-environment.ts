import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import type { Compression, Environment, ResourceLoader } from "./environment.js";

class NodeLoader implements ResourceLoader {
  constructor(private readonly baseDir?: string) { }

  async load(source: string): Promise<ArrayBuffer> {
    if (/^https?:\/\//i.test(source)) {
      const res = await fetch(source);
      if (!res.ok) {
        throw new Error(`Failed to fetch resource: ${source} (${res.status})`);
      }
      return await res.arrayBuffer();
    }

    const resolved = this.baseDir ? path.resolve(this.baseDir, source) : source;
    const buffer = await readFile(resolved);
    const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return bytes.slice().buffer;
  }
}

class NodeCompression implements Compression {
  async inflateRaw(data: Uint8Array): Promise<Uint8Array> {
    const inflated = inflateRawSync(data);
    return new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.byteLength);
  }
}

/**
 * Default Node environment implementation.
 * Base directory is optional and used for resolving relative file paths.
 */
export class NodeEnvironment implements Environment {
  readonly loader: ResourceLoader;
  readonly compression: Compression;

  constructor(baseDir?: string) {
    this.loader = new NodeLoader(baseDir);
    this.compression = new NodeCompression();
  }

  resolveLocal(source: string, base?: string): string {
    // URLs and data URIs pass through unchanged
    if (/^(https?:)?\/\//i.test(source) || /^data:/i.test(source)) {
      return source;
    }
    // Strip leading slash to treat as document-relative (not filesystem-absolute)
    // This ensures /images/duck.jpg resolves to {base}/images/duck.jpg, not C:\images\duck.jpg on Windows
    const normalized = source.startsWith('/') ? source.slice(1) : source;
    const resolved = base ? path.resolve(base, normalized) : path.resolve(normalized);
    return resolved;
  }

  now(): number {
    return Date.now();
  }

  getEnv(name: string): string | undefined {
    return process.env[name];
  }
}
