/**
 * Helper to set the global environment for browser builds.
 * Use this to avoid threading Environment through every call when bootstrapping.
 */
import type { Environment } from "./environment.js";
import type { ExtendedGlobalThis } from "../types/core.js";

export function setGlobalEnvironment(env: Environment): void {
  const global = globalThis as ExtendedGlobalThis;
  global.__PAGYRA_ENV__ = env;
}

export function getGlobalEnvironment(): Environment | undefined {
  const global = globalThis as ExtendedGlobalThis;
  return global.__PAGYRA_ENV__ as Environment | undefined;
}
