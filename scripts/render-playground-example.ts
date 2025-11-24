#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderHtmlToPdf } from '../src/html-to-pdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let debugLevel: string | undefined;
  let debugCats: string[] | undefined;
  let examplePathArg: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--debug-level' && i + 1 < args.length) {
      debugLevel = args[i + 1] as any; // will validate later
      i++;
    } else if (arg === '--debug-cats' && i + 1 < args.length) {
      debugCats = args[i + 1].split(',').map(cat => cat.trim()).filter(Boolean);
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

  console.log('Rendering playground example to PDF:', examplePath);
  // Provide resource/asset roots so example-relative and absolute (/images/...) URLs resolve
  const resourceBaseDir = path.dirname(examplePath);
  const assetRootDir = path.join(repoRoot, 'playground', 'public');

  const pdf = await renderHtmlToPdf({
    html,
    css: '',
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 800,
    pageHeight: 600,
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    debug: false,
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
