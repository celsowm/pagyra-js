import { buildBrowserBundle } from "./browser-build.js";

const args = process.argv.slice(2);
const getArg = (prefix: string): string | undefined => {
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

const target = getArg("--target=") ?? "dist";
const watch = args.includes("--watch");
const explicitMinify = args.includes("--minify");
const explicitSourcemap = args.includes("--sourcemap");

const targetConfigs: Record<
  string,
  { entry: string; outfile: string; minify: boolean; sourcemap: boolean }
> = {
  dist: {
    entry: "src/browser-entry.ts",
    outfile: "dist/browser/pagyra.min.js",
    minify: true,
    sourcemap: true,
  },
  playground: {
    entry: "playground/browser-entry.ts",
    outfile: "playground/public/vendor/pagyra-playground-browser.js",
    minify: false,
    sourcemap: true,
  },
};

const targetConfig = targetConfigs[target] ?? targetConfigs.dist;

const entry = getArg("--entry=") ?? targetConfig.entry;
const outfile = getArg("--outfile=") ?? targetConfig.outfile;
const minify = explicitMinify || targetConfig.minify;
const sourcemap = explicitSourcemap || targetConfig.sourcemap;

const buildOptions = {
  entry,
  outfile,
  minify,
  sourcemap,
  watch,
};

try {
  await buildBrowserBundle(buildOptions);
} catch (error) {
  console.error("[build-browser-bundle] failed:", error);
  process.exit(1);
}
