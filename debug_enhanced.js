import { readFile, writeFile } from "fs/promises";
import { renderHtmlToPdf } from "./dist/src/html-to-pdf.js";

async function testWithEnhancedDebug() {
  try {
    const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Enhanced Debug</title>
</head>
<body>
    <p>Teste com <strong>negrito</strong> e <em>itálico</em>.</p>
</body>
</html>`;
    
    console.log("=== ENHANCED FONTSTYLE DEBUG ===");
    
    // Add console logging to capture all debug output
    const originalLog = console.log;
    const logs = [];
    console.log = (...args) => {
      const message = args.join(' ');
      logs.push(message);
      originalLog(...args);
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
    
    // Look for font-related logs
    const fontLogs = logs.filter(log => 
      log.includes('FONT_DEBUG') || 
      log.includes('encoding-path') || 
      log.includes('Times-')
    );
    
    console.log('\n🔍 FONT-RELATED LOGS:');
    fontLogs.forEach((log, i) => console.log(`${i + 1}. ${log}`));
    
    await writeFile("enhanced_debug.pdf", pdf);
    console.log("Generated: enhanced_debug.pdf");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testWithEnhancedDebug();
