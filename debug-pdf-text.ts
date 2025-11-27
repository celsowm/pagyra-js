// Debug script to trace PDF text commands for accented characters
import { parseTtfFont } from "./src/pdf/font/ttf-lite.js";
import { computeGlyphRun } from "./src/pdf/utils/node-text-run-factory.js";
import { drawGlyphRun } from "./src/pdf/utils/glyph-run-renderer.js";
import { createPdfFontSubset } from "./src/pdf/font/font-subset.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontPath = path.join(__dirname, "assets/fonts/ttf/tinos/Tinos-Bold.ttf");
const metrics = parseTtfFont(fontPath);

const testText = "AÇÃO";
const fontSize = 18.666666666666668; // From the debug output

console.log("=== Testing AÇÃO rendering ===\n");

// Create a mock UnifiedFont
const unifiedFont = {
  metrics: {
    metrics: metrics.metrics,
    glyphMetrics: metrics.glyphMetrics,
    cmap: metrics.cmap,
    headBBox: metrics.headBBox,
    kerning: metrics.kerning,
  },
  program: {
    sourceFormat: "ttf" as const,
    unitsPerEm: metrics.metrics.unitsPerEm,
    glyphCount: metrics.glyphMetrics.size,
    getGlyphOutline: metrics.getGlyphOutline,
    getRawTableData: () => null, // Minimal implementation
  },
  css: {
    family: "Tinos",
    weight: 700,
    style: "normal" as const,
  },
};

// Compute glyph run
const letterSpacing = 0;
const glyphRun = computeGlyphRun(unifiedFont, testText, fontSize, letterSpacing);

console.log("GlyphRun:");
console.log("  text:", glyphRun.text);
console.log("  glyphIds:", glyphRun.glyphIds);
console.log("  positions:", glyphRun.positions);
console.log("  width:", glyphRun.width);
console.log("  fontSize:", glyphRun.fontSize);

// Create font subset
const usedGlyphIds = new Set(glyphRun.glyphIds);
const subset = createPdfFontSubset({
  baseName: "TinosBold",
  fontMetrics: metrics,
  fontProgram: unifiedFont.program,
  usedGlyphIds,
  encoding: "identity",
});

console.log("\nSubset:");
console.log("  name:", subset.name);
console.log("  widths length:", subset.widths.length);
console.log("  glyphIds:", subset.glyphIds);

// Test encodeGlyph
console.log("\nGlyph encoding:");
for (const gid of glyphRun.glyphIds) {
  const encoded = subset.encodeGlyph(gid);
  console.log(`  GID ${gid} -> charCode ${encoded} (0x${encoded.toString(16).padStart(4, '0')})`);
}

// Now draw the glyph run
const fontSizePt = fontSize * 0.75; // px to pt
const x = 100;
const y = 700;
const color = { r: 0, g: 0, b: 0, a: 1 };

console.log("\n=== Drawing glyph run ===");
console.log("  x:", x);
console.log("  y:", y);
console.log("  fontSizePt:", fontSizePt);

const commands = drawGlyphRun(glyphRun, subset, x, y, fontSizePt, color);

console.log("\nPDF commands:");
for (const cmd of commands) {
  console.log(" ", cmd);
}

// Analyze the positions and expected advances
console.log("\n=== Position Analysis for PDF ===");
const unitsPerEm = metrics.metrics.unitsPerEm;
const ptPerPx = fontSizePt / fontSize;

for (let i = 0; i < glyphRun.glyphIds.length; i++) {
  const gid = glyphRun.glyphIds[i];
  const char = testText[i];
  const pos = glyphRun.positions[i];
  const gm = metrics.glyphMetrics.get(gid);
  
  console.log(`\nGlyph ${i}: "${char}" (GID ${gid})`);
  console.log(`  Position: x=${pos.x.toFixed(4)} px`);
  console.log(`  advanceWidth: ${gm?.advanceWidth} font units`);
  
  if (i < glyphRun.glyphIds.length - 1) {
    const nextPos = glyphRun.positions[i + 1];
    const desiredAdvancePx = nextPos.x - pos.x;
    const defaultAdvancePx = ((gm?.advanceWidth ?? 0) / unitsPerEm) * fontSize;
    const deltaPx = desiredAdvancePx - defaultAdvancePx;
    const deltaPt = deltaPx * ptPerPx;
    const adjustment = -deltaPt / fontSizePt * 1000;
    
    console.log(`  desiredAdvancePx: ${desiredAdvancePx.toFixed(4)}`);
    console.log(`  defaultAdvancePx: ${defaultAdvancePx.toFixed(4)}`);
    console.log(`  deltaPx: ${deltaPx.toFixed(6)}`);
    console.log(`  PDF adjustment: ${adjustment.toFixed(6)}`);
  }
}
