import { log } from "../logging/debug.js";
import type { Environment } from "../environment/environment.js";
import { decodeBase64ToUint8Array } from "../utils/base64.js";

export function resolveLocalPath(target: string, resourceBaseDir: string, assetRootDir: string, environment: Environment): string {
  let result = target;
  if (result.startsWith("file://")) {
    result = environment.fileURLToPath ? environment.fileURLToPath(result) : result;
  } else if (result.startsWith("/")) {
    result = environment.pathResolve ? environment.pathResolve(assetRootDir, `.${result}`) : result;
  } else if (!(environment.pathIsAbsolute ? environment.pathIsAbsolute(result) : result.includes(":"))) {
    result = environment.pathResolve ? environment.pathResolve(resourceBaseDir, result) : result;
  }
  return result;
}

export function selectLocalBase(target: string, resourceBaseDir: string, assetRootDir: string): string {
  if (target.trim().startsWith("/")) {
    return assetRootDir || resourceBaseDir;
  }
  return resourceBaseDir || assetRootDir;
}

export async function loadStylesheetFromHref(
  href: string,
  resourceBaseDir: string,
  assetRootDir: string,
  environment: Environment,
): Promise<string> {
  const trimmed = href.trim();
  if (!trimmed) return "";

  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("//")) {
      const absoluteHref = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
      const response = await fetch(absoluteHref);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const cssText = await response.text();
      return rewriteCssUrls(cssText, absoluteHref);
    }

    const localBase = selectLocalBase(trimmed, resourceBaseDir, assetRootDir);
    const cssPath = environment.resolveLocal
      ? environment.resolveLocal(trimmed, localBase || undefined)
      : resolveLocalPath(trimmed, resourceBaseDir, assetRootDir, environment);
    const cssBuffer = await environment.loader.load(cssPath);
    const cssText = new TextDecoder("utf-8").decode(cssBuffer);
    const baseHref = /^https?:\/\//i.test(cssPath) || cssPath.startsWith("file:")
      ? cssPath
      : (environment.pathToFileURL ? environment.pathToFileURL(cssPath) : cssPath);
    return rewriteCssUrls(cssText, baseHref);
  } catch (error) {
    log("parse", "warn", "Failed to load stylesheet", { href, error: error instanceof Error ? error.message : String(error) });
    return "";
  }
}

export function rewriteCssUrls(cssText: string, baseHref: string): string {
  let base: URL;
  try {
    base = new URL(baseHref);
  } catch {
    return cssText;
  }

  const urlRegex = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  return cssText.replace(urlRegex, (match, quote: string, rawUrl: string) => {
    const candidate = (rawUrl || "").trim();
    if (!candidate || /^data:/i.test(candidate)) return match;
    if (/^[a-z][a-z0-9+\-.]*:/i.test(candidate)) return match;
    try {
      const resolved = new URL(candidate, base).toString();
      const q = quote || "";
      return `url(${q}${resolved}${q})`;
    } catch {
      return match;
    }
  });
}

export async function loadFontData(
  src: string,
  resourceBaseDir: string,
  assetRootDir: string,
  environment: Environment,
): Promise<ArrayBuffer | null> {
  const trimmed = src.trim();
  if (!trimmed) return null;
  let target = trimmed;

  try {
    if (target.startsWith("//")) {
      target = `https:${target}`;
    }

    if (/^data:/i.test(target)) {
      const commaIdx = target.indexOf(",");
      if (commaIdx === -1) {
        throw new Error("Invalid data URI");
      }
      const meta = target.slice(5, commaIdx);
      if (!/;base64/i.test(meta)) {
        throw new Error("Only base64-encoded data URIs are supported for fonts");
      }
      const data = decodeBase64ToUint8Array(target.slice(commaIdx + 1));
      const copy = data.slice();
      return copy.buffer;
    }

    if (/^https?:\/\//i.test(target)) {
      const response = await fetch(target);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.arrayBuffer();
    }

    if (/^file:/i.test(target)) {
      const localPath = environment.fileURLToPath ? environment.fileURLToPath(target) : target;
      return await environment.loader.load(localPath);
    }

    const localBase = selectLocalBase(target, resourceBaseDir, assetRootDir);
    const resolved = environment.resolveLocal
      ? environment.resolveLocal(target, localBase || undefined)
      : resolveLocalPath(target, resourceBaseDir, assetRootDir, environment);
    return await environment.loader.load(resolved);
  } catch (error) {
    log("font", "warn", "Failed to load font data", { src, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

