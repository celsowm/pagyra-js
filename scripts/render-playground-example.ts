#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderHtmlToPdf } from '../src/html-to-pdf.js';
import { DEFAULT_PAGE_WIDTH_PX, DEFAULT_PAGE_HEIGHT_PX } from '../src/units/page-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let debugLevel: string | undefined;
  let debugCats: string[] | undefined;
  let examplePathArg: string | undefined;
  let pageWidth: number | undefined;
  let pageHeight: number | undefined;
  let margins: { top: number; right: number; bottom: number; left: number } | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--debug-level' && i + 1 < args.length) {
      debugLevel = args[i + 1] as any; // will validate later
      i++;
    } else if (arg === '--debug-cats' && i + 1 < args.length) {
      debugCats = args[i + 1].split(',').map(cat => cat.trim()).filter(Boolean);
      i++;
    } else if (arg === '--page-width' && i + 1 < args.length) {
      pageWidth = parseFloat(args[i + 1]);
      i++;
    } else if (arg === '--page-height' && i + 1 < args.length) {
      pageHeight = parseFloat(args[i + 1]);
      i++;
    } else if (arg === '--margins' && i + 1 < args.length) {
      const marginValues = args[i + 1].split(',').map(m => parseFloat(m.trim()));
      if (marginValues.length === 1) {
        margins = { top: marginValues[0], right: marginValues[0], bottom: marginValues[0], left: marginValues[0] };
      } else if (marginValues.length === 2) {
        margins = { top: marginValues[0], right: marginValues[1], bottom: marginValues[0], left: marginValues[1] };
      } else if (marginValues.length === 4) {
        margins = { top: marginValues[0], right: marginValues[1], bottom: marginValues[2], left: marginValues[3] };
      } else {
        console.warn('Invalid --margins argument. Expected 1, 2, or 4 comma-separated numbers (e.g., "10", "10,20", "10,20,30,40").');
      }
      i++;
    } else if (!arg.startsWith('--')) {
      examplePathArg = arg;
    }
  }

  const repoRoot = path.resolve(__dirname, '..');
  const examplesDir = path.join(repoRoot, 'playground', 'public', 'examples');
  // Allow passing an example path or filename as the first argument. If it's a filename,
  // resolve it under playground/public/examples. Otherwise use the default demo.
  const arg = examplePathArg;
  let examplePath: string;
  if (arg) {
    // Try a few sensible resolutions for the provided argument.
    const candidateAbsolute = path.isAbsolute(arg) ? arg : path.join(repoRoot, arg);
    const candidateExamples = path.join(examplesDir, arg);
    try {
      await fs.stat(candidateAbsolute);
      examplePath = candidateAbsolute;
    } catch {
      try {
        await fs.stat(candidateExamples);
        examplePath = candidateExamples;
      } catch {
        const withHtml = candidateExamples.endsWith('.html') ? '' : '.html';
        const candidateWithExt = candidateExamples + withHtml;
        try {
          await fs.stat(candidateWithExt);
          examplePath = candidateWithExt;
        } catch {
          // Fallback: resolve under examplesDir (may still error later when reading)
          examplePath = candidateExamples;
        }
      }
    }
  } else {
    examplePath = path.join(examplesDir, 'svg-radial-transform-demo.html');
  }
  const outDir = path.join(repoRoot, 'playground', 'exports');
  await fs.mkdir(outDir, { recursive: true });

  const html = await fs.readFile(examplePath, 'utf8');

  const finalPageWidth = pageWidth ?? DEFAULT_PAGE_WIDTH_PX;
  const finalPageHeight = pageHeight ?? DEFAULT_PAGE_HEIGHT_PX;

  console.log('Rendering playground example to PDF:', examplePath);
  // Provide resource/asset roots so example-relative and absolute (/images/...) URLs resolve
  const resourceBaseDir = path.dirname(examplePath);
  const assetRootDir = path.join(repoRoot, 'playground', 'public');

  const pdf = await renderHtmlToPdf({
    html,
    css: '',
    viewportWidth: finalPageWidth,
    viewportHeight: finalPageHeight,
    pageWidth: finalPageWidth,
    pageHeight: finalPageHeight,
    margins: margins ?? { top: 0, right: 0, bottom: 0, left: 0 },
    debug: !!(debugLevel || debugCats),
    debugLevel: debugLevel as any,
    debugCats,
    resourceBaseDir,
    assetRootDir,
  });

  const outName = path.basename(examplePath).replace(/\.html?$/i, '') + '.pdf';
  const outPath = path.join(outDir, outName);
  await fs.writeFile(outPath, pdf);
  console.log('PDF written to:', outPath);
}

main().catch(err => {
  console.error('Error rendering playground example:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
