/**
 * Run glyph atlas tuner (sample fonts + synthetic) and print recommended atlas settings.
 *
 * Usage (from repo root):
 *  - With ts-node (recommended):
 *      npx ts-node scripts/run-glyph-atlas-tuner.ts
 *  - Or via node if you have ts-node registered:
 *      node -r ts-node/register scripts/run-glyph-atlas-tuner.ts
 *
 * Notes:
 *  - This script imports project modules (TS sources). When running with ts-node,
 *    TypeScript files are resolved directly (we import .ts paths here to avoid
 *    Node ESM resolving .js which caused ERR_MODULE_NOT_FOUND).
 *
 * What it does:
 *  - Loads fonts from ./assets/fonts
 *  - For each font samples up to N glyphs (attempts to rasterize glyph masks at fontSizePx)
 *  - Adds synthetic samples (small/medium/large)
 *  - Runs pickAtlasSettingsFromSamples(...) and prints the chosen settings
 */

import fs from "fs";
import path from "path";

// IMPORTANT: import the .ts modules (ts-node resolves .ts imports). This avoids Node ESM looking for .js files.
import { parseTtfFont } from "../src/pdf/font/ttf-lite.ts";
import { getGlyphMask, clearGlyphMaskCache } from "../src/pdf/font/glyph-cache.ts";
import { pickAtlasSettingsFromSamples } from "../src/pdf/font/glyph-atlas-tuner.ts";

async function sampleFromFont(fontPath: string, opts: { maxGlyphs?: number; fontSizePx?: number } = {}) {
  const samples: Array<{ width: number; height: number }> = [];
  const maxGlyphs = opts.maxGlyphs ?? 200;
  const fontSizePx = opts.fontSizePx ?? 64;

  try {
    const metrics = parseTtfFont(fontPath);
    // Try to sample from glyphMetrics map if available
    const glyphCount = metrics.glyphMetrics ? metrics.glyphMetrics.size : Math.max(256, maxGlyphs);
    const limit = Math.min(maxGlyphs, glyphCount);

    // Prefer to sample glyph IDs present in the metrics map
    if (metrics.glyphMetrics && metrics.glyphMetrics.size > 0) {
      let i = 0;
      for (const [gid] of metrics.glyphMetrics) {
        if (i >= limit) break;
        try {
          const mask = getGlyphMask(metrics as any, gid, fontSizePx, 4);
          if (mask && mask.width > 0 && mask.height > 0) {
            samples.push({ width: mask.width, height: mask.height });
            i++;
          }
        } catch (e) {
          // ignore glyphs that fail during rasterization
        }
      }
    } else {
      // Fallback: try glyph ids 0..limit-1
      for (let gid = 0; gid < limit; gid++) {
        try {
          const mask = getGlyphMask(metrics as any, gid, fontSizePx, 4);
          if (mask && mask.width > 0 && mask.height > 0) {
            samples.push({ width: mask.width, height: mask.height });
          }
        } catch (e) {
          // continue
        }
      }
    }

    // Clear any packed atlas/cache artifacts between fonts to avoid skew
    clearGlyphMaskCache();
  } catch (err) {
    console.error("Failed to parse font", fontPath, err instanceof Error ? err.message : err);
  }

  return samples;
}

function syntheticSamples(): Array<{ width: number; height: number }> {
  // Provide a sensible mixture of sizes: small glyphs, punctuation, medium letters, large capitals
  const arr: Array<{ width: number; height: number }> = [];
  // many small
  for (let i = 0; i < 40; i++) arr.push({ width: 8, height: 10 });
  // medium
  for (let i = 0; i < 40; i++) arr.push({ width: 20 + (i % 10), height: 24 + (i % 8) });
  // larger
  for (let i = 0; i < 20; i++) arr.push({ width: 48 + (i % 16), height: 56 + (i % 10) });
  // some very large glyphs (accents, icons)
  for (let i = 0; i < 6; i++) arr.push({ width: 128, height: 140 });
  return arr;
}

async function run() {
  const fontDir = path.resolve(process.cwd(), "assets", "fonts");
  let fontFiles: string[] = [];
  try {
    const files = fs.readdirSync(fontDir);
    fontFiles = files
      .filter((f) => /\.(ttf|otf|woff2?)$/i.test(f))
      .map((f) => path.join(fontDir, f));
  } catch (e) {
    console.warn("No bundled fonts found in assets/fonts — continuing with synthetic samples only");
  }

  console.log("Found fonts:", fontFiles.map((p) => path.basename(p)));
  const allSamples: Array<{ width: number; height: number }> = [];

  for (const fontPath of fontFiles) {
    console.log("Sampling font:", path.basename(fontPath));
    const s = await sampleFromFont(fontPath, { maxGlyphs: 200, fontSizePx: 64 });
    console.log(`  -> collected ${s.length} samples from ${path.basename(fontPath)}`);
    allSamples.push(...s);
  }

  // add synthetic
  const synth = syntheticSamples();
  console.log("Adding", synth.length, "synthetic samples");
  allSamples.push(...synth);

  if (allSamples.length === 0) {
    console.warn("No samples gathered — returning conservative defaults");
    console.log("Suggested settings: pageSize=2048, padding=1");
    return;
  }

  // Run tuner
  const settings = pickAtlasSettingsFromSamples(allSamples, { candidates: [1024, 2048, 4096], paddings: [0, 1, 2, 3] });
  console.log("Tuner result:", settings);
  console.log("");
  console.log("If you want to apply these settings to the MaxRects packer in-code, the recommended values are:");
  console.log(`  pageSize: ${settings.pageSize}`);
  console.log(`  padding:  ${settings.padding}`);
  console.log(`Estimated pages: ${settings.estimatedPages}, wastedRatio: ${settings.wastedRatio.toFixed(3)}`);
  console.log("");
  console.log("To apply, update the MaxRects packer defaults in src/pdf/font/glyph-atlas-maxrects.ts (constructor or export) or pass these values when constructing the packer.");
}

run().catch((err) => {
  console.error("Error running tuner script:", err);
  process.exit(1);
});
