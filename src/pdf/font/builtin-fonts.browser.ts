import { log } from "../../logging/debug.js";
import type { Environment } from "../../environment/environment.js";
import { BrowserEnvironment } from "../../environment/browser-environment.js";
import type { FontConfig, FontFaceDef } from "../../types/fonts.js";

type FontSource = "assets" | "google";

type BuiltinFace = Omit<FontFaceDef, "src" | "data"> & { file: string; google?: string };

type GlobalFontConfig = {
  __PAGYRA_FONT_BASE?: string;
  __PAGYRA_FONT_SOURCE?: string;
  __PAGYRA_USE_GOOGLE_FONTS?: boolean;
};

const BUILTIN_FACES: BuiltinFace[] = [
  // Sans: primary and UI-friendly
  { name: "Lato-Regular", family: "Lato", weight: 400, style: "normal", file: "woff2/lato/lato-latin-400-normal.woff2", google: "Lato" },
  { name: "Lato-Bold", family: "Lato", weight: 700, style: "normal", file: "woff2/lato/lato-latin-700-normal.woff2", google: "Lato" },
  { name: "Lato-Italic", family: "Lato", weight: 400, style: "italic", file: "woff2/lato/lato-latin-400-italic.woff2", google: "Lato" },
  { name: "Lato-BoldItalic", family: "Lato", weight: 700, style: "italic", file: "woff2/lato/lato-latin-700-italic.woff2", google: "Lato" },
  { name: "Roboto-Regular", family: "Roboto", weight: 400, style: "normal", file: "ttf/roboto/Roboto-Regular.ttf", google: "Roboto" },
  { name: "Roboto-Bold", family: "Roboto", weight: 700, style: "normal", file: "ttf/roboto/Roboto-Bold.ttf", google: "Roboto" },
  { name: "Roboto-Italic", family: "Roboto", weight: 400, style: "italic", file: "ttf/roboto/Roboto-Italic.ttf", google: "Roboto" },
  { name: "Roboto-BoldItalic", family: "Roboto", weight: 700, style: "italic", file: "ttf/roboto/Roboto-BoldItalic.ttf", google: "Roboto" },
  { name: "Arimo-Regular", family: "Arimo", weight: 400, style: "normal", file: "ttf/arimo/Arimo-Regular.ttf", google: "Arimo" },
  { name: "Arimo-Bold", family: "Arimo", weight: 700, style: "normal", file: "ttf/arimo/Arimo-Bold.ttf", google: "Arimo" },
  { name: "Arimo-Italic", family: "Arimo", weight: 400, style: "italic", file: "ttf/arimo/Arimo-Italic.ttf", google: "Arimo" },
  { name: "Arimo-BoldItalic", family: "Arimo", weight: 700, style: "italic", file: "ttf/arimo/Arimo-BoldItalic.ttf", google: "Arimo" },
  { name: "NotoSans-Regular", family: "Noto Sans", weight: 400, style: "normal", file: "ttf/notosans/NotoSans-Regular.ttf", google: "Noto Sans" },
  { name: "DejaVuSans-Regular", family: "DejaVu Sans", weight: 400, style: "normal", file: "ttf/dejavu/DejaVuSans.ttf" },

  // Serif / display
  { name: "Tinos-Regular", family: "Tinos", weight: 400, style: "normal", file: "ttf/tinos/Tinos-Regular.ttf", google: "Tinos" },
  { name: "Tinos-Bold", family: "Tinos", weight: 700, style: "normal", file: "ttf/tinos/Tinos-Bold.ttf", google: "Tinos" },
  { name: "Tinos-Italic", family: "Tinos", weight: 400, style: "italic", file: "ttf/tinos/Tinos-Italic.ttf", google: "Tinos" },
  { name: "Tinos-BoldItalic", family: "Tinos", weight: 700, style: "italic", file: "ttf/tinos/Tinos-BoldItalic.ttf", google: "Tinos" },
  { name: "CinzelDecorative-Regular", family: "Cinzel Decorative", weight: 400, style: "normal", file: "ttf/cinzeldecorative/CinzelDecorative-Regular.ttf", google: "Cinzel Decorative" },
  { name: "CinzelDecorative-Bold", family: "Cinzel Decorative", weight: 700, style: "normal", file: "ttf/cinzeldecorative/CinzelDecorative-Bold.ttf", google: "Cinzel Decorative" },
  { name: "CinzelDecorative-Black", family: "Cinzel Decorative", weight: 900, style: "normal", file: "ttf/cinzeldecorative/CinzelDecorative-Black.ttf", google: "Cinzel Decorative" },
  { name: "Caveat-Regular", family: "Caveat", weight: 400, style: "normal", file: "woff2/caveat/Caveat-Regular.woff2", google: "Caveat" },
  { name: "Caveat-Bold", family: "Caveat", weight: 700, style: "normal", file: "woff2/caveat/Caveat-Bold.woff2", google: "Caveat" },

  // Monospace
  { name: "FiraCode-Light", family: "Fira Code", weight: 300, style: "normal", file: "ttf/firecode/FiraCode-Light.ttf", google: "Fira Code" },
  { name: "FiraCode-Regular", family: "Fira Code", weight: 400, style: "normal", file: "ttf/firecode/FiraCode-Regular.ttf", google: "Fira Code" },
  { name: "FiraCode-Medium", family: "Fira Code", weight: 500, style: "normal", file: "ttf/firecode/FiraCode-Medium.ttf", google: "Fira Code" },
  { name: "FiraCode-SemiBold", family: "Fira Code", weight: 600, style: "normal", file: "ttf/firecode/FiraCode-SemiBold.ttf", google: "Fira Code" },
  { name: "FiraCode-Bold", family: "Fira Code", weight: 700, style: "normal", file: "ttf/firecode/FiraCode-Bold.ttf", google: "Fira Code" },

  // Emoji
  { name: "NotoEmoji-Light", family: "Noto Emoji", weight: 300, style: "normal", file: "ttf/notoemoji/NotoEmoji-Light.ttf" },
  { name: "NotoEmoji-Regular", family: "Noto Emoji", weight: 400, style: "normal", file: "ttf/notoemoji/NotoEmoji-Regular.ttf" },
  { name: "NotoEmoji-Medium", family: "Noto Emoji", weight: 500, style: "normal", file: "ttf/notoemoji/NotoEmoji-Medium.ttf" },
  { name: "NotoEmoji-SemiBold", family: "Noto Emoji", weight: 600, style: "normal", file: "ttf/notoemoji/NotoEmoji-SemiBold.ttf" },
  { name: "NotoEmoji-Bold", family: "Noto Emoji", weight: 700, style: "normal", file: "ttf/notoemoji/NotoEmoji-Bold.ttf" },

  // Math
  { name: "STIXTwoMath-Regular", family: "STIX Two Math", weight: 400, style: "normal", file: "ttf/stixtwomath/STIXTwoMath-Regular.ttf" },
];

const DEFAULT_STACK: string[] = [
  "Lato",
  "Roboto",
  "Arimo",
  "Noto Sans",
  "DejaVu Sans",
  "Tinos",
  "Fira Code",
  "Caveat",
  "Cinzel Decorative",
  "Noto Emoji",
  "STIX Two Math",
];

let cachedConfig: FontConfig | null | undefined;
let cachedSource: FontSource | null = null;
let loading: Promise<FontConfig | null> | null = null;

export async function loadBuiltinFontConfig(environment: Environment = new BrowserEnvironment()): Promise<FontConfig | null> {
  const source = resolveFontSource();
  if (cachedConfig !== undefined && cachedSource === source) {
    return cachedConfig;
  }
  if (loading && cachedSource === source) {
    return loading;
  }

  cachedSource = source;

  loading = (async () => {
    // Try the selected source; if google fails and was explicitly selected, fall back to assets.
    if (source === "google") {
      const googleFaces = await loadFromGoogleFonts(environment);
      if (googleFaces.length) {
        cachedConfig = { fontFaceDefs: googleFaces, defaultStack: DEFAULT_STACK };
        return cachedConfig;
      }
      log("font", "warn", "Google Fonts requested but none loaded; falling back to bundled assets");
    }

    const assetFaces = await loadFromAssets(environment);
    cachedConfig = assetFaces.length ? { fontFaceDefs: assetFaces, defaultStack: DEFAULT_STACK } : null;
    return cachedConfig;
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

function computeBaseUrl(): string {
  const globalConfig = globalThis as GlobalFontConfig;
  const globalBase = globalConfig.__PAGYRA_FONT_BASE;
  if (typeof globalBase === "string" && globalBase.trim().length > 0) {
    return ensureTrailingSlash(globalBase.trim());
  }
  if (typeof window !== "undefined" && window.location) {
    const origin = window.location.origin.endsWith("/") ? window.location.origin : `${window.location.origin}/`;
    return `${origin}assets/fonts/`;
  }
  try {
    return new URL("../../assets/fonts/", import.meta.url).toString();
  } catch {
    return "/assets/fonts/";
  }
}

function ensureTrailingSlash(input: string): string {
  return input.endsWith("/") ? input : `${input}/`;
}

function resolveFontSource(): FontSource {
  const globalConfig = globalThis as GlobalFontConfig;
  const globalSource = globalConfig.__PAGYRA_FONT_SOURCE;
  const legacyGoogle = globalConfig.__PAGYRA_USE_GOOGLE_FONTS;
  if (typeof globalSource === "string") {
    const normalized = globalSource.toLowerCase();
    if (normalized === "google") return "google";
    if (normalized === "assets") return "assets";
  }
  if (legacyGoogle === true) {
    return "google";
  }
  return "assets";
}

async function loadFromAssets(environment: Environment): Promise<FontFaceDef[]> {
  const baseUrl = computeBaseUrl();
  const faces: FontFaceDef[] = [];
  for (const face of BUILTIN_FACES) {
    const url = new URL(face.file, baseUrl).toString();
    try {
      log("font", "debug", "Loading browser font file", { url });
      const buffer = await environment.loader.load(url);
      faces.push({
        name: face.name,
        family: face.family,
        weight: face.weight,
        style: face.style,
        src: url,
        data: buffer,
      });
    } catch (error) {
      log("font", "warn", "Failed to load font file", { url, error });
    }
  }
  return faces;
}

async function loadFromGoogleFonts(environment: Environment): Promise<FontFaceDef[]> {
  const requestable = BUILTIN_FACES.filter((f) => !!f.google);
  if (!requestable.length) return [];

  const cssUrl = buildGoogleCssUrl(requestable);
  if (!cssUrl) return [];

  try {
    log("font", "debug", "Fetching Google Fonts CSS", { url: cssUrl });
    const cssBuffer = await environment.loader.load(cssUrl);
    const cssText = new TextDecoder().decode(cssBuffer);
    const faceUrls = parseGoogleCss(cssText);

    const faces: FontFaceDef[] = [];
    for (const face of requestable) {
      const key = faceKey(face.family, face.weight, face.style);
      const url = faceUrls.get(key);
      if (!url) {
        log("font", "warn", "Google Fonts entry missing", { family: face.family, weight: face.weight, style: face.style });
        continue;
      }
      try {
        log("font", "debug", "Downloading Google font file", { url, family: face.family, weight: face.weight, style: face.style });
        const buffer = await environment.loader.load(url);
        faces.push({
          name: face.name,
          family: face.family,
          weight: face.weight,
          style: face.style,
          src: url,
          data: buffer,
        });
      } catch (error) {
        log("font", "warn", "Failed to download Google font", { url, family: face.family, weight: face.weight, style: face.style, error });
      }
    }
    return faces;
  } catch (error) {
    log("font", "warn", "Failed to load Google Fonts CSS", { url: cssUrl, error });
    return [];
  }
}

function buildGoogleCssUrl(faces: BuiltinFace[]): string {
  const byFamily = new Map<string, Set<string>>();
  for (const face of faces) {
    if (!face.google) continue;
    const key = face.google;
    let set = byFamily.get(key);
    if (!set) {
      set = new Set();
      byFamily.set(key, set);
    }
    const ital = face.style === "italic" ? 1 : 0;
    set.add(`${ital},${face.weight}`);
  }

  const families: string[] = [];
  for (const [family, combos] of byFamily) {
    const comboList = Array.from(combos).sort();
    const param = `family=${encodeGoogleFamily(family)}:ital,wght@${comboList.join(";")}`;
    families.push(param);
  }

  if (!families.length) return "";
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}

function encodeGoogleFamily(family: string): string {
  return encodeURIComponent(family.replace(/\s+/g, "+"));
}

function parseGoogleCss(cssText: string): Map<string, string> {
  const result = new Map<string, string>();
  const blockRegex = /@font-face\s*{[^}]*}/g;
  for (const blockMatch of cssText.matchAll(blockRegex)) {
    const block = blockMatch[0];
    const familyMatch = /font-family:\s*['"]?([^'";]+)['"]?/i.exec(block);
    const weightMatch = /font-weight:\s*([0-9]+)/i.exec(block);
    const styleMatch = /font-style:\s*(italic|normal)/i.exec(block);
    const srcMatch = /src:\s*[^;]*url\(([^)]+)\)/i.exec(block);
    if (!familyMatch || !weightMatch || !styleMatch || !srcMatch) continue;

    const family = familyMatch[1].trim();
    const weight = Number.parseInt(weightMatch[1], 10);
    const style = styleMatch[1].toLowerCase() === "italic" ? "italic" : "normal";
    const url = srcMatch[1].replace(/['"]/g, "").trim();
    const key = faceKey(family, weight, style);
    if (!result.has(key)) {
      result.set(key, url);
    }
  }
  return result;
}

function faceKey(family: string, weight: number, style: string): string {
  return `${family.toLowerCase()}@${weight}@${style.toLowerCase()}`;
}
