/**
 * Helper to set the global environment for browser builds.
 * Use this to avoid threading Environment through every call when bootstrapping.
 */
import type { Environment } from "./environment.js";

export function setGlobalEnvironment(env: Environment): void {
  (globalThis as any).__PAGYRA_ENV__ = env;
}

export function getGlobalEnvironment(): Environment | undefined {
  return (globalThis as any).__PAGYRA_ENV__ as Environment | undefined;
}
