import { readFile, writeFile } from "fs/promises";
import { renderHtmlToPdf } from "./dist/src/html-to-pdf.js";

// Temporarily patch the computeStyleForElement function to add debugging
const originalRenderHtmlToPdf = renderHtmlToPdf;

async function testWithFontStyleTrace() {
  try {
    const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>FontStyle Trace</title>
</head>
<body>
    <p>Teste com <strong>negrito</strong> e <em>itálico</em>.</p>
</body>
</html>`;
    
    console.log("=== TRACING FONTSTYLE PROPERTY ===");
    
    // Add debugging to the font registry calls
    const originalEnsureFontSubset = await import('./dist/src/pdf/font/font-registry.js').then(m => m.ensureFontSubsetSync);
    
    console.log("Testing with enhanced debug...");
    
    const pdf = await renderHtmlToPdf({
      html,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 595,
      pageHeight: 842,
      margins: { top: 50, right: 50, bottom: 50, left: 50 },
      debug: true
    });
    
    await writeFile("fontstyle_trace.pdf", pdf);
    console.log("Generated: fontstyle_trace.pdf");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testWithFontStyleTrace();
