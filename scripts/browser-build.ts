import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild, { type BuildOptions, type BuildFailure, type Plugin, type PluginBuild } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const resolveProjectPath = (relativePath: string): string => path.resolve(PROJECT_ROOT, relativePath);

const alias: Record<string, string> = {
  "node:path": resolveProjectPath("src/shim/empty.ts"),
  path: resolveProjectPath("src/shim/empty.ts"),
  "node:url": resolveProjectPath("src/shim/url-empty.ts"),
  url: resolveProjectPath("src/shim/url-empty.ts"),
  "node:fs/promises": resolveProjectPath("src/shim/fs-empty.ts"),
  fs: resolveProjectPath("src/shim/fs-empty.ts"),
  "node:zlib": resolveProjectPath("src/shim/zlib-empty.ts"),
  zlib: resolveProjectPath("src/shim/zlib-empty.ts"),
  "node:util": resolveProjectPath("src/shim/empty.ts"),
  util: resolveProjectPath("src/shim/empty.ts"),
  "src/environment/node-environment.ts": resolveProjectPath("src/environment/node-environment.browser.ts"),
  "src/pdf/font/builtin-fonts.ts": resolveProjectPath("src/pdf/font/builtin-fonts.browser.ts"),
};

export interface BrowserBundleOptions {
  entry: string;
  outfile: string;
  minify?: boolean;
  sourcemap?: boolean | "external" | "inline";
  watch?: boolean;
  onRebuild?: (error: BuildFailure | null, result: unknown | null) => void;
}

function buildOptionsFor(opts: BrowserBundleOptions): BuildOptions {
  const entryPoints = [resolveProjectPath(opts.entry)];
  const outfile = resolveProjectPath(opts.outfile);

  const plugins: Plugin[] = [];

  if (opts.watch) {
    let isFirst = true;
    plugins.push({
      name: "watch-callback",
      setup(build: PluginBuild) {
        build.onEnd((result) => {
          if (isFirst) {
            isFirst = false;
            return;
          }
          if (opts.onRebuild) {
            const hasErrors = result.errors?.length;
            opts.onRebuild(hasErrors ? (result as unknown as BuildFailure) : null, result);
            return;
          }
          if (result.errors?.length) {
            console.error("[browser bundle] rebuild failed:", result.errors);
          } else {
            console.log("[browser bundle] rebuild succeeded.");
          }
        });
      },
    } as esbuild.Plugin);
  }

  const config: BuildOptions = {
    entryPoints,
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    mainFields: ["browser", "module", "main"],
    alias,
    minify: opts.minify ?? false,
    sourcemap: opts.sourcemap ?? false,
    plugins,
  };

  return config;
}

export interface BrowserBundleResult {
  stop?: () => Promise<void> | void;
}

export async function buildBrowserBundle(opts: BrowserBundleOptions): Promise<BrowserBundleResult> {
  console.log(`[browser bundle] ${opts.entry} → ${opts.outfile} (${opts.watch ? "watch" : "build"})`);
  const config = buildOptionsFor(opts);

  if (!opts.watch) {
    await esbuild.build(config);
    console.log("[browser bundle] build complete");
    return {};
  }

  const context = await esbuild.context(config);
  await context.watch();
  console.log("[browser bundle] initial build complete, watching for changes…");
  return {
    stop: () => context.dispose(),
  };
}
