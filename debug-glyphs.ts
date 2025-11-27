/**
 * Debug glyph mappings
 */
import { loadBuiltinFontConfig } from "./src/pdf/font/builtin-fonts.js";
import { parseTtfBuffer } from "./src/pdf/font/ttf-lite.js";

async function main() {
  const fontConfig = await loadBuiltinFontConfig();
  if (!fontConfig) {
    console.log("No font config");
    return;
  }

  const tinosBold = fontConfig.fontFaceDefs.find(f => f.name === "Tinos-Bold");
  if (!tinosBold?.data) {
    console.log("No Tinos-Bold");
    return;
  }

  const metrics = parseTtfBuffer(tinosBold.data);
  
  // Check what codepoints map to glyphs 0, 3, 32, 36, 100, 172, 50
  const glyphsToCheck = [0, 3, 32, 36, 50, 100, 172, 65535];
  
  console.log("Checking which characters map to specific glyphs:");
  for (const targetGid of glyphsToCheck) {
    // Search all codepoints
    const matches: string[] = [];
    for (let cp = 0; cp <= 0xFFFF; cp++) {
      const gid = metrics.cmap.getGlyphId(cp);
      if (gid === targetGid) {
        const char = String.fromCodePoint(cp);
        const charDesc = cp === 32 ? "SPACE" : cp < 128 ? char : `U+${cp.toString(16).toUpperCase()}`;
        matches.push(charDesc);
        if (matches.length >= 5) break;
      }
    }
    console.log(`GID ${targetGid}: ${matches.join(", ") || "(no matches)"}`);
  }

  console.log("\nChecking glyphs for AÇÃO characters:");
  for (const [char, cp] of [["A", 65], ["Ç", 199], ["Ã", 195], ["O", 79], [" ", 32]]) {
    const gid = metrics.cmap.getGlyphId(cp as number);
    console.log(`'${char}' (U+${(cp as number).toString(16).toUpperCase()}): GID=${gid}`);
  }
}

main();
