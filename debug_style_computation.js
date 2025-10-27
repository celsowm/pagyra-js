import { readFile, writeFile } from "fs/promises";
import { renderHtmlToPdf } from "./dist/src/html-to-pdf.js";

async function testStyleComputation() {
  try {
    const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Debug Style</title>
</head>
<body>
    <p>Teste com <strong>negrito</strong> e <em>itálico</em>.</p>
</body>
</html>`;
    
    console.log("=== TESTING STYLE COMPUTATION ===");
    
    // Patch console.log to capture debug output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push(message);
      originalLog(...args);
      
      // Check for fontStyle in logs
      if (message.includes('fontStyle') || message.includes('font-weight') || message.includes('font-family')) {
        console.log('🔍 STYLE DEBUG:', message);
      }
    };
    
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
    
    console.log = originalLog;
    
    // Filter and show style-related logs
    const styleLogs = logs.filter(log => 
      log.includes('font') || 
      log.includes('FONT') || 
      log.includes('strong') || 
      log.includes('em')
    );
    
    console.log('\n📋 STYLE-RELATED LOGS:');
    styleLogs.forEach(log => console.log(log));
    
    await writeFile("style_debug.pdf", pdf);
    console.log("Generated: style_debug.pdf");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testStyleComputation();
