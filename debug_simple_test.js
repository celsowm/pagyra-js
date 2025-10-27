import { readFile, writeFile } from "fs/promises";
import { renderHtmlToPdf } from "./dist/src/html-to-pdf.js";

async function testBoldItalicConversion() {
  try {
    const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Teste Bold e Italic</title>
</head>
<body>
    <p>Teste com <strong>negrito</strong> e <em>itálico</em>.</p>
</body>
</html>`;
    
    console.log("=== TESTING BOLD/ITALIC CONVERSION ===");
    console.log("Input HTML:", html);
    
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
    
    await writeFile("test_result.pdf", pdf);
    console.log("Generated: test_result.pdf");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testBoldItalicConversion();
