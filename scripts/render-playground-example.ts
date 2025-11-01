#!/usr/bin/env tsx
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderHtmlToPdf } from '../src/html-to-pdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const examplesDir = path.join(repoRoot, 'playground', 'public', 'examples');
  // Allow passing an example path or filename as the first argument. If it's a filename,
  // resolve it under playground/public/examples. Otherwise use the default demo.
  const arg = process.argv[2];
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
        // Fallback: resolve under examplesDir (may still error later when reading)
        examplePath = candidateExamples;
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
