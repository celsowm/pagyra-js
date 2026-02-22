import type { FontConfig } from "../types/fonts.js";
import type { Environment } from "../environment/environment.js";
import { loadFontData } from "./resource-loader.js";

export function pickFontUrlFromSrc(src: string): string | null {
  const urlRegex = /url\(\s*(['"]?)([^'")]+)\1\s*\)(?:\s*format\(\s*['"]?([^'")]+)['"]?\s*\))?/gi;
  let fallback: string | null = null;
  let preferred: string | null = null;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(src)) !== null) {
    const url = match[2];
    const format = (match[3] || "").toLowerCase();
    if (!fallback) fallback = url;
    if (format === "woff2") {
      preferred = url;
      break;
    }
  }

  return preferred ?? fallback;
}

export function parseFontWeight(weightStr: string): number {
  const normalized = weightStr.trim().toLowerCase();
  if (normalized === "bold") return 700;
  if (normalized === "normal") return 400;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : 400;
}

export function normalizeFontStyle(styleStr: string): "normal" | "italic" {
  const normalized = styleStr.trim().toLowerCase();
  return normalized.includes("italic") || normalized.includes("oblique") ? "italic" : "normal";
}

interface ResourcePathContext {
  resourceBaseDir: string;
  assetRootDir: string;
  environment: Environment;
}

interface ParsedFontFaceRule {
  declarations: Record<string, string>;
}

export async function appendFontFacesFromCssRules(
  fontFaceRules: ParsedFontFaceRule[],
  fontConfig: FontConfig | undefined,
  paths: ResourcePathContext,
): Promise<void> {
  if (!fontConfig) {
    return;
  }

  for (const fontFace of fontFaceRules) {
    const fontFamily = fontFace.declarations["font-family"]?.replace(/['"]/g, "");
    const src = fontFace.declarations["src"];
    if (!fontFamily || !src) {
      continue;
    }

    const targetUrl = pickFontUrlFromSrc(src);
    if (!targetUrl) {
      continue;
    }

    const fontData = await loadFontData(targetUrl, paths.resourceBaseDir, paths.assetRootDir, paths.environment);
    if (!fontData) {
      continue;
    }

    const weightStr = fontFace.declarations["font-weight"] || "400";
    const styleStr = fontFace.declarations["font-style"] || "normal";
    fontConfig.fontFaceDefs.push({
      name: fontFamily,
      family: fontFamily,
      src: targetUrl,
      data: fontData,
      weight: parseFontWeight(weightStr),
      style: normalizeFontStyle(styleStr),
    });
  }
}

export async function ensureFontFaceDataLoaded(
  fontConfig: FontConfig | undefined,
  paths: ResourcePathContext,
): Promise<void> {
  if (!fontConfig) {
    return;
  }

  for (const face of fontConfig.fontFaceDefs) {
    if (!face.data && face.src) {
      const loaded = await loadFontData(face.src, paths.resourceBaseDir, paths.assetRootDir, paths.environment);
      if (loaded) {
        (face as { data: ArrayBuffer }).data = loaded;
      }
    }
  }
}

