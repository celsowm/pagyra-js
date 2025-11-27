// Debug script for border-radius issue - complete pipeline test
import { renderHtmlToPdf } from "./src/html-to-pdf.js";
import { configureDebug } from "./src/logging/debug.js";
import * as fs from "fs";

// Configure debug output
configureDebug({ level: "warn", cats: [] });

// Use the exact same HTML as in the user's request
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rounded Border Example</title>
  <style>
    .rounded-box {
      display: inline-block;
      padding: 20px 30px;
      border: 2px solid #333;
      border-radius: 15px;
      background-color: #f9f9f9;
      text-align: center;
      font-family: Arial, sans-serif;
    }
  </style>
</head>
<body>
  <div class="rounded-box">
    <span>border-radius: 15px</span>
  </div>
</body>
</html>`;

async function debugBorderRadius() {
  const pdfBytes = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 612,
    pageHeight: 792,
    margins: { top: 72, right: 72, bottom: 72, left: 72 },
    debug: false,
  });

  // Save the PDF
  fs.writeFileSync("debug-border-radius-output.pdf", pdfBytes);
  console.log("PDF saved to debug-border-radius-output.pdf");
  console.log("PDF size:", pdfBytes.length, "bytes");

  // Extract and analyze ALL content from Stream 8 (the main content stream)
  const pdfString = Buffer.from(pdfBytes).toString("latin1");
  const streamMatches = pdfString.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g);
  
  if (streamMatches) {
    // Find the content stream with our shapes
    for (let i = 0; i < streamMatches.length; i++) {
      const stream = streamMatches[i];
      if (stream.includes(" rg") && stream.includes(" cm")) {
        console.log(`\n=== Stream ${i} (likely main content) ===`);
        
        // Split by 'Q' to see individual operations
        const operations = stream.split(/Q\s*\n/);
        console.log(`Number of graphics state groups: ${operations.length}`);
        
        // Show each operation
        for (let j = 0; j < operations.length; j++) {
          const op = operations[j].trim();
          if (op.length > 10) {
            console.log(`\n--- Operation ${j} ---`);
            // Just show first 500 chars
            console.log(op.substring(0, 500));
          }
        }
      }
    }
  }
}

debugBorderRadius().catch(console.error);
