/**
 * Debug space width in fonts
 */
import { loadBuiltinFontConfig } from "./src/pdf/font/builtin-fonts.js";
import { parseTtfBuffer } from "./src/pdf/font/ttf-lite.js";

async function main() {
  const fontConfig = await loadBuiltinFontConfig();
  if (!fontConfig) {
    console.log("No font config");
    return;
  }

  for (const face of fontConfig.fontFaceDefs) {
    if (!face.data) continue;
    
    try {
      const metrics = parseTtfBuffer(face.data);
      const spaceGid = metrics.cmap.getGlyphId(32);
      const spaceMetrics = metrics.glyphMetrics.get(spaceGid);
      const spaceWidth = spaceMetrics?.advanceWidth ?? 0;
      const em = metrics.metrics.unitsPerEm;
      const ratio = spaceWidth / em;
      
      console.log(`${face.name}: space=${spaceWidth} units, em=${em}, ratio=${ratio.toFixed(3)} (at 14pt = ${(14 * ratio).toFixed(2)}pt)`);
    } catch (e) {
      console.log(`${face.name}: error`);
    }
  }
}

main();
