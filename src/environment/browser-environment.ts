/**
 * Browser implementation of the Environment interfaces.
 * Uses fetch for loading and DecompressionStream for inflateRaw (with a guard).
 */
import type { Compression, Environment, ResourceLoader } from "./environment.js";

class BrowserLoader implements ResourceLoader {
  async load(source: string): Promise<ArrayBuffer> {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch resource: ${source} (${response.status})`);
    }
    return await response.arrayBuffer();
  }
}

const DecompressionStreamCtor: typeof DecompressionStream | undefined = (globalThis as any).DecompressionStream;

class BrowserCompression implements Compression {
  async inflateRaw(data: Uint8Array): Promise<Uint8Array> {
    if (!DecompressionStreamCtor) {
      throw new Error("DecompressionStream not available; provide a polyfill (e.g., pako) for inflateRaw.");
    }
    const stream = new DecompressionStreamCtor("deflate-raw");
    const writer = stream.writable.getWriter();
    await writer.write(new Uint8Array(data) as BufferSource);
    await writer.close();
    const reader = stream.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }
}

export class BrowserEnvironment implements Environment {
  readonly loader: ResourceLoader;
  readonly compression: Compression;

  constructor() {
    this.loader = new BrowserLoader();
    this.compression = new BrowserCompression();
  }

  resolveLocal(source: string, base?: string): string {
    if (/^data:/i.test(source)) return source;
    if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(source) || source.startsWith("//")) {
      return source;
    }
    if (base) {
      try {
        return new URL(source, base).toString();
      } catch {
        // ignore and fall through
      }
    }
    throw new Error(`Local path resolution is not supported in browser environment: ${source}`);
  }

  now(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  getEnv(_name: string): string | undefined {
    return undefined;
  }
}
