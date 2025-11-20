import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../../debug/log.js";
import type { FontConfig, FontFaceDef } from "../../types/fonts.js";

type BuiltinFace = Omit<FontFaceDef, "src" | "data"> & { file: string };

const BUILTIN_FACES: BuiltinFace[] = [
  { name: "Roboto-Regular", family: "Roboto", weight: 400, style: "normal", file: "ttf/roboto/Roboto-Regular.ttf" },
  { name: "Roboto-Bold", family: "Roboto", weight: 700, style: "normal", file: "ttf/roboto/Roboto-Bold.ttf" },
  { name: "Roboto-Italic", family: "Roboto", weight: 400, style: "italic", file: "ttf/roboto/Roboto-Italic.ttf" },
  { name: "Roboto-BoldItalic", family: "Roboto", weight: 700, style: "italic", file: "ttf/roboto/Roboto-BoldItalic.ttf" },
  { name: "NotoSans-Regular", family: "Noto Sans", weight: 400, style: "normal", file: "ttf/notosans/NotoSans-Regular.ttf" },
  { name: "DejaVuSans-Regular", family: "DejaVu Sans", weight: 400, style: "normal", file: "ttf/dejavu/DejaVuSans.ttf" },
  { name: "Tinos-Regular", family: "Tinos", weight: 400, style: "normal", file: "ttf/tinos/Tinos-Regular.ttf" },
  { name: "Tinos-Bold", family: "Tinos", weight: 700, style: "normal", file: "ttf/tinos/Tinos-Bold.ttf" },
  { name: "Tinos-Italic", family: "Tinos", weight: 400, style: "italic", file: "ttf/tinos/Tinos-Italic.ttf" },
  { name: "Tinos-BoldItalic", family: "Tinos", weight: 700, style: "italic", file: "ttf/tinos/Tinos-BoldItalic.ttf" },
  { name: "Arimo-Regular", family: "Arimo", weight: 400, style: "normal", file: "ttf/arimo/Arimo-Regular.ttf" },
  { name: "Arimo-Bold", family: "Arimo", weight: 700, style: "normal", file: "ttf/arimo/Arimo-Bold.ttf" },
  { name: "Arimo-Italic", family: "Arimo", weight: 400, style: "italic", file: "ttf/arimo/Arimo-Italic.ttf" },
  { name: "Arimo-BoldItalic", family: "Arimo", weight: 700, style: "italic", file: "ttf/arimo/Arimo-BoldItalic.ttf" },
];

let cachedConfig: FontConfig | null | undefined;
let loading: Promise<FontConfig | null> | null = null;

export async function loadBuiltinFontConfig(): Promise<FontConfig | null> {

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
      console.log("Builtin font baseDir:", baseDir);
      const faces: FontFaceDef[] = [];
      for (const face of BUILTIN_FACES) {
        const filePath = path.join(baseDir, face.file);
        console.log("Loading font file:", filePath);
        try {
          const buffer = await readFile(filePath);
          faces.push({
            name: face.name,
            family: face.family,
            weight: face.weight,
            style: face.style,
            src: filePath,
            data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
          });
        } catch (err) {
          console.warn(`Failed to load font file: ${filePath}`, err);
        }
      }
      cachedConfig = {
        fontFaceDefs: faces,
        defaultStack: ["Noto Sans", "Roboto", "Tinos", "Arimo", "DejaVu Sans"],
      };
      return cachedConfig;
    } catch (error) {
      log("FONT", "WARN", "Unable to load builtin font config", { error });
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
