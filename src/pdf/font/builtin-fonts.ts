import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../../logging/debug.js";
import type { FontConfig, FontFaceDef } from "../../types/fonts.js";
import type { Environment } from "../../environment/environment.js";
import { NodeEnvironment } from "../../environment/node-environment.js";

type BuiltinFace = Omit<FontFaceDef, "src" | "data"> & { file: string };

const BUILTIN_FACES: BuiltinFace[] = [
  // Sans: primary and UI-friendly
  { name: "Lato-Regular", family: "Lato", weight: 400, style: "normal", file: "woff2/lato/lato-latin-400-normal.woff2" },
  { name: "Lato-Bold", family: "Lato", weight: 700, style: "normal", file: "woff2/lato/lato-latin-700-normal.woff2" },
  { name: "Lato-Italic", family: "Lato", weight: 400, style: "italic", file: "woff2/lato/lato-latin-400-italic.woff2" },
  { name: "Lato-BoldItalic", family: "Lato", weight: 700, style: "italic", file: "woff2/lato/lato-latin-700-italic.woff2" },
  { name: "Roboto-Regular", family: "Roboto", weight: 400, style: "normal", file: "ttf/roboto/Roboto-Regular.ttf" },
  { name: "Roboto-Bold", family: "Roboto", weight: 700, style: "normal", file: "ttf/roboto/Roboto-Bold.ttf" },
  { name: "Roboto-Italic", family: "Roboto", weight: 400, style: "italic", file: "ttf/roboto/Roboto-Italic.ttf" },
  { name: "Roboto-BoldItalic", family: "Roboto", weight: 700, style: "italic", file: "ttf/roboto/Roboto-BoldItalic.ttf" },
  { name: "Arimo-Regular", family: "Arimo", weight: 400, style: "normal", file: "ttf/arimo/Arimo-Regular.ttf" },
  { name: "Arimo-Bold", family: "Arimo", weight: 700, style: "normal", file: "ttf/arimo/Arimo-Bold.ttf" },
  { name: "Arimo-Italic", family: "Arimo", weight: 400, style: "italic", file: "ttf/arimo/Arimo-Italic.ttf" },
  { name: "Arimo-BoldItalic", family: "Arimo", weight: 700, style: "italic", file: "ttf/arimo/Arimo-BoldItalic.ttf" },
  { name: "NotoSans-Regular", family: "Noto Sans", weight: 400, style: "normal", file: "ttf/notosans/NotoSans-Regular.ttf" },
  { name: "DejaVuSans-Regular", family: "DejaVu Sans", weight: 400, style: "normal", file: "ttf/dejavu/DejaVuSans.ttf" },

  // Serif / display
  { name: "Tinos-Regular", family: "Tinos", weight: 400, style: "normal", file: "ttf/tinos/Tinos-Regular.ttf" },
  { name: "Tinos-Bold", family: "Tinos", weight: 700, style: "normal", file: "ttf/tinos/Tinos-Bold.ttf" },
  { name: "Tinos-Italic", family: "Tinos", weight: 400, style: "italic", file: "ttf/tinos/Tinos-Italic.ttf" },
  { name: "Tinos-BoldItalic", family: "Tinos", weight: 700, style: "italic", file: "ttf/tinos/Tinos-BoldItalic.ttf" },
  { name: "CinzelDecorative-Regular", family: "Cinzel Decorative", weight: 400, style: "normal", file: "ttf/cinzeldecorative/CinzelDecorative-Regular.ttf" },
  { name: "CinzelDecorative-Bold", family: "Cinzel Decorative", weight: 700, style: "normal", file: "ttf/cinzeldecorative/CinzelDecorative-Bold.ttf" },
  { name: "CinzelDecorative-Black", family: "Cinzel Decorative", weight: 900, style: "normal", file: "ttf/cinzeldecorative/CinzelDecorative-Black.ttf" },
  { name: "Caveat-Regular", family: "Caveat", weight: 400, style: "normal", file: "woff2/caveat/Caveat-Regular.woff2" },
  { name: "Caveat-Bold", family: "Caveat", weight: 700, style: "normal", file: "woff2/caveat/Caveat-Bold.woff2" },

  // Monospace
  { name: "FiraCode-Light", family: "Fira Code", weight: 300, style: "normal", file: "ttf/firecode/FiraCode-Light.ttf" },
  { name: "FiraCode-Regular", family: "Fira Code", weight: 400, style: "normal", file: "ttf/firecode/FiraCode-Regular.ttf" },
  { name: "FiraCode-Medium", family: "Fira Code", weight: 500, style: "normal", file: "ttf/firecode/FiraCode-Medium.ttf" },
  { name: "FiraCode-SemiBold", family: "Fira Code", weight: 600, style: "normal", file: "ttf/firecode/FiraCode-SemiBold.ttf" },
  { name: "FiraCode-Bold", family: "Fira Code", weight: 700, style: "normal", file: "ttf/firecode/FiraCode-Bold.ttf" },

  // Emoji
  { name: "NotoEmoji-Light", family: "Noto Emoji", weight: 300, style: "normal", file: "ttf/notoemoji/NotoEmoji-Light.ttf" },
  { name: "NotoEmoji-Regular", family: "Noto Emoji", weight: 400, style: "normal", file: "ttf/notoemoji/NotoEmoji-Regular.ttf" },
  { name: "NotoEmoji-Medium", family: "Noto Emoji", weight: 500, style: "normal", file: "ttf/notoemoji/NotoEmoji-Medium.ttf" },
  { name: "NotoEmoji-SemiBold", family: "Noto Emoji", weight: 600, style: "normal", file: "ttf/notoemoji/NotoEmoji-SemiBold.ttf" },
  { name: "NotoEmoji-Bold", family: "Noto Emoji", weight: 700, style: "normal", file: "ttf/notoemoji/NotoEmoji-Bold.ttf" },

  // Math
  { name: "STIXTwoMath-Regular", family: "STIX Two Math", weight: 400, style: "normal", file: "ttf/stixtwomath/STIXTwoMath-Regular.ttf" },
];

let cachedConfig: FontConfig | null | undefined;
let loading: Promise<FontConfig | null> | null = null;

export async function loadBuiltinFontConfig(environment: Environment = new NodeEnvironment()): Promise<FontConfig | null> {
  if (loading) {
    return loading;
  }
  if (!isNodeRuntime()) {
    cachedConfig = null;
    return null;
  }

  loading = (async () => {
    try {
      const baseDir = resolveFontsDir();
      log('font', 'debug', "Builtin font baseDir:", baseDir);
      const faces: FontFaceDef[] = [];
      for (const face of BUILTIN_FACES) {
        const filePath = path.join(baseDir, face.file);
        log('font', 'debug', "Loading font file:", filePath);
        try {
          const buffer = await environment.loader.load(filePath);
          faces.push({
            name: face.name,
            family: face.family,
            weight: face.weight,
            style: face.style,
            src: filePath,
            data: buffer,
          });
        } catch (err) {
          log('font', 'warn', `Failed to load font file: ${filePath}`, err);
        }
      }
      cachedConfig = {
        fontFaceDefs: faces,
        defaultStack: [
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
        ],
      };
      return cachedConfig;
    } catch (error) {
      log("font", 'warn', "Unable to load builtin font config", { error });
      cachedConfig = null;
      return null;
    } finally {
      loading = null;
    }
  })();

  return loading;
}

function resolveFontsDir(): string {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(here), "../../../assets/fonts");
}

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && !!process.versions?.node;
}
