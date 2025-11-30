// Browser stub: NodeEnvironment is unavailable in browser builds.
import type { Environment, ResourceLoader, Compression } from "./environment.js";

class NoopLoader implements ResourceLoader {
  async load(_source: string): Promise<ArrayBuffer> {
    throw new Error("NodeEnvironment is not available in browser builds");
  }
}

class NoopCompression implements Compression {
  async inflateRaw(_data: Uint8Array): Promise<Uint8Array> {
    throw new Error("NodeEnvironment compression is not available in browser builds");
  }
}

export class NodeEnvironment implements Environment {
  readonly loader: ResourceLoader = new NoopLoader();
  readonly compression: Compression = new NoopCompression();
  resolveLocal(): string {
    throw new Error("NodeEnvironment resolveLocal is not available in browser builds");
  }
  now(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }
}
