/**
 * Runner that imports compiled JS from dist and runs the atlas tuner.
 * Use after building the project: `npm run build`
 *
 * Run with: `node scripts/run-glyph-atlas-tuner-runner.mjs`
 *
 * This avoids ts-node resolution issues by using the compiled output.
 */

import fs from "fs";
import path from "path";

import { parseTtfFont } from "../dist/src/pdf/font/ttf-lite.js";
import { getGlyphMask, clearGlyphMaskCache } from "../dist/src/pdf/font/glyph-cache.js";
import { pickAtlasSettingsFromSamples } from "../dist/src/pdf/font/glyph-atlas-tuner.js";

async function sampleFromFont(fontPath, opts = {}) {
  const samples = [];
  const maxGlyphs = opts.maxGlyphs ?? 200;
  const fontSizePx = opts.fontSizePx ?? 64;

  try {
    const metrics = parseTtfFont(fontPath);
    const glyphCount = metrics.glyphMetrics ? metrics.glyphMetrics.size : Math.max(256, maxGlyphs);
    const limit = Math.min(maxGlyphs, glyphCount);

    if (metrics.glyphMetrics && metrics.glyphMetrics.size > 0) {
      let i = 0;
      for (const [gid] of metrics.glyphMetrics) {
        if (i >= limit) break;
        try {
          const mask = getGlyphMask(metrics, gid, fontSizePx, 4);
          if (mask && mask.width > 0 && mask.height > 0) {
            samples.push({ width: mask.width, height: mask.height });
            i++;
          }
        } catch (e) {
          // ignore
        }
      }
    } else {
      for (let gid = 0; gid < limit; gid++) {
        try {
          const mask = getGlyphMask(metrics, gid, fontSizePx, 4);
          if (mask && mask.width > 0 && mask.height > 0) {
            samples.push({ width: mask.width, height: mask.height });
          }
        } catch (e) {}
      }
    }

    clearGlyphMaskCache();
  } catch (err) {
    console.error("Failed to parse font", fontPath, err && err.message ? err.message : err);
  }

  return samples;
}

function syntheticSamples() {
  const arr = [];
  for (let i = 0; i < 40; i++) arr.push({ width: 8, height: 10 });
  for (let i = 0; i < 40; i++) arr.push({ width: 20 + (i % 10), height: 24 + (i % 8) });
  for (let i = 0; i < 20; i++) arr.push({ width: 48 + (i % 16), height: 56 + (i % 10) });
  for (let i = 0; i < 6; i++) arr.push({ width: 128, height: 140 });
  return arr;
}

async function run() {
  const fontDir = path.resolve(process.cwd(), "assets", "fonts");
  let fontFiles = [];
  try {
    const files = fs.readdirSync(fontDir);
    fontFiles = files.filter((f) => /\.(ttf|otf|woff2?)$/i.test(f)).map((f) => path.join(fontDir, f));
  } catch (e) {
    console.warn("No bundled fonts found in assets/fonts — continuing with synthetic samples only");
  }

  console.log("Found fonts:", fontFiles.map((p) => path.basename(p)));
  const allSamples = [];

  for (const fontPath of fontFiles) {
    console.log("Sampling font:", path.basename(fontPath));
    const s = await sampleFromFont(fontPath, { maxGlyphs: 200, fontSizePx: 64 });
    console.log(`  -> collected ${s.length} samples from ${path.basename(fontPath)}`);
    allSamples.push(...s);
  }

  const synth = syntheticSamples();
  console.log("Adding", synth.length, "synthetic samples");
  allSamples.push(...synth);

  if (allSamples.length === 0) {
    console.warn("No samples gathered — returning conservative defaults");
    console.log("Suggested settings: pageSize=2048, padding=1");
    return;
  }

  const settings = pickAtlasSettingsFromSamples(allSamples, { candidates: [1024, 2048, 4096], paddings: [0, 1, 2, 3] });
  console.log("Tuner result:", settings);
  console.log("");
  console.log("Recommended values to apply to MaxRects packer:");
  console.log(`  pageSize: ${settings.pageSize}`);
  console.log(`  padding:  ${settings.padding}`);
  console.log(`Estimated pages: ${settings.estimatedPages}, wastedRatio: ${settings.wastedRatio.toFixed(3)}`);
  console.log("");
  console.log("If you want me to apply these settings to src/pdf/font/glyph-atlas-maxrects.ts I can do that now.");
}

run().catch((err) => {
  console.error("Error running tuner runner:", err);
  process.exit(1);
});
