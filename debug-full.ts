/**
 * Debug completo do fluxo de renderização
 */
import { renderHtmlToPdf } from "./src/html-to-pdf.js";
import * as fs from "node:fs";

async function main() {
  const html = `
    <html>
    <body>
    <p style="text-align: center;">
       <span style="font-size: 14pt; font-weight: bold;">AÇÃO DE INDENIZAÇÃO POR DANOS MATERIAIS E MORAIS</span>
    </p>
    </body>
    </html>
  `;

  const result = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 816,
    viewportHeight: 1056,
    pageWidth: 612,
    pageHeight: 792,
    margins: { top: 72, right: 72, bottom: 72, left: 72 },
  });

  fs.writeFileSync("debug-output.pdf", result);
  console.log("PDF saved to debug-output.pdf");

  // Analisar o conteúdo do PDF
  const pdfText = new TextDecoder("latin1").decode(result);
  
  // Encontrar blocos de texto BT...ET
  const textBlockRegex = /BT[\s\S]*?ET/g;
  const textBlocks = pdfText.match(textBlockRegex) || [];
  
  console.log(`\n=== Encontrados ${textBlocks.length} blocos de texto ===\n`);
  
  // Analisar posições e calcular larguras
  console.log("=== Posições e larguras dos blocos de texto ===");
  const positions: {x: number, glyphs: number[], hasAcao: boolean}[] = [];
  
  for (let i = 0; i < textBlocks.length; i++) {
    const block = textBlocks[i];
    const tdMatch = block.match(/([\d.]+)\s+([\d.]+)\s+Td/);
    const hexMatches = block.match(/<([0-9A-Fa-f]+)>/g) || [];
    
    // Decodificar todos os hex
    const allGlyphs: number[] = [];
    for (const hm of hexMatches) {
      const hex = hm.replace(/[<>]/g, "");
      for (let j = 0; j < hex.length; j += 4) {
        const gid = parseInt(hex.substring(j, j + 4), 16);
        allGlyphs.push(gid);
      }
    }
    
    // Verificar se contém glyphs de AÇÃO (36, 100, 172, 50)
    const hasAcao = allGlyphs.includes(36) && allGlyphs.includes(100) && allGlyphs.includes(172);
    
    if (tdMatch) {
      const x = parseFloat(tdMatch[1]);
      positions.push({ x, glyphs: allGlyphs, hasAcao });
    }
  }
  
  // Show positions with calculated widths
  for (let i = 0; i < positions.length; i++) {
    const curr = positions[i];
    const next = positions[i + 1];
    const width = next ? (next.x - curr.x).toFixed(2) : "?";
    const marker = curr.hasAcao ? " <-- AÇÃO" : "";
    const glyphInfo = `glyphs=[${curr.glyphs.slice(0, 6).join(",")}${curr.glyphs.length > 6 ? "..." : ""}]`;
    console.log(`Bloco ${i + 16}: x=${curr.x.toFixed(2)}, width=${width}pt ${glyphInfo}${marker}`);
  }

  // Show raw content of first text blocks
  console.log("\n=== Raw content of text blocks 16-22 ===");
  for (let i = 15; i < Math.min(22, textBlocks.length); i++) {
    console.log(`\nBlock ${i + 1}:`);
    console.log(textBlocks[i].substring(0, 300));
  }

  // Find font references in text blocks
  console.log("\n=== Font usage in text blocks ===");
  for (let i = 15; i < Math.min(textBlocks.length, 25); i++) {
    const block = textBlocks[i];
    const fontMatch = block.match(/\/(F\d+)\s+(\d+(?:\.\d+)?)\s+Tf/);
    const hexMatch = block.match(/<([0-9A-Fa-f]+)>/);
    if (fontMatch) {
      console.log(`Block ${i + 1}: Font=${fontMatch[1]}, Size=${fontMatch[2]}`);
    }
  }
  
  // Find font definitions
  console.log("\n=== Font definitions ===");
  const fontDefRegex = /\/BaseFont\s*\/([^\s\/]+)/g;
  const fontDefs = [...pdfText.matchAll(fontDefRegex)];
  for (const fd of fontDefs) {
    console.log(`BaseFont: ${fd[1]}`);
  }

  // Find font descriptor with W array
  const fontDictRegex = /\/Type\s+\/Font[\s\S]*?\/W\s*\[([^\]]+(?:\[[^\]]*\][^\]]*)*)\]/g;
  const matches = [...pdfText.matchAll(fontDictRegex)];
  
  // Also look for W arrays in CIDFont definitions
  const widthsRegex = /\/W\s*\[([^\]]+(?:\[[^\]]*\][^\]]*)*)\]/g;
  const widthMatches = [...pdfText.matchAll(widthsRegex)];
  
  console.log("\n=== W arrays in PDF ===");
  for (let i = 0; i < widthMatches.length; i++) {
    const wContent = widthMatches[i][1].trim();
    // Parse to find glyph 3 width
    // Format is like: 0 [778 0 250 250 333 555...]
    // where 0 is start glyph, and array has widths for glyphs 0, 1, 2, 3...
    const arrayMatch = wContent.match(/^\d+\s*\[([^\]]+)\]/);
    if (arrayMatch) {
      const widths = arrayMatch[1].trim().split(/\s+/).map(Number);
      console.log(`W array ${i + 1}: glyph 0=${widths[0]}, glyph 3 (space)=${widths[3]}, glyph 36 (A)=${widths[36]}`);
    }
  }

  // Verificar se há TJ com ajustes
  console.log("\n=== Blocos com ajustes TJ ===");
  for (let i = 0; i < textBlocks.length; i++) {
    const block = textBlocks[i];
    if (block.includes("] TJ")) {
      console.log(`Bloco ${i + 1}:`);
      const tjContent = block.match(/\[([^\]]+)\]\s*TJ/);
      if (tjContent) {
        console.log(`  TJ content: ${tjContent[1].substring(0, 100)}...`);
      }
    }
  }
}

main().catch(console.error);
