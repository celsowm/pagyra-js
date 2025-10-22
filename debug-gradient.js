import { renderHtmlToPdf } from "./src/index.js";

// Simple HTML with gradient
const HTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    .gradient-rectangle {
      width: 200px;
      height: 100px;
      background: linear-gradient(to right, red, yellow);
      border: 2px solid black;
    }
  </style>
</head>
<body>
  <div class="gradient-rectangle"></div>
</body>
</html>`;

async function main() {
  try {
    console.log("Starting gradient test...");
    
    const pdf = await renderHtmlToPdf({
      html: HTML,
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 595.28,
      pageHeight: 841.89,
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
    });
    
    console.log("PDF generated successfully, size:", pdf.length);
    
    // Save to file for inspection
    const fs = require('fs');
    fs.writeFileSync('debug-gradient.pdf', Buffer.from(pdf));
    console.log("PDF saved as debug-gradient.pdf");
    
    // Convert to string for analysis
    const decoder = new TextDecoder("latin1");
    const pdfStr = decoder.decode(pdf);
    
    console.log("PDF content preview:");
    console.log(pdfStr.substring(0, 1000));
    
    // Check for patterns
    const patternMatches = pdfStr.match(/\/Pattern/g) || [];
    const gradMatches = pdfStr.match(/\/Grad/g) || [];
    console.log("Pattern references:", patternMatches.length);
    console.log("Grad references:", gradMatches.length);
    
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
