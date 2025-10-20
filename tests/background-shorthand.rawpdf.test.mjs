import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Import the library's PDF rendering function
import { renderHtmlToPdf } from "../src/html-to-pdf.js"; // Adjusted path to actual API

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    .box {
      width: 300px;
      height: 200px;
      background: #0000ff;        /* shorthand we just added */
      border: 5px solid #0000ff;  /* verifies stroking path too */
    }
 </style>
</head>
<body>
  <div class="box"></div>
</body>
</html>`;

async function main() {
  // Render the HTML to PDF
  // Note: The library doesn't seem to have direct compression options in the public API,
  // but the content stream should still be readable in the output
  const pdfBuffer = await renderHtmlToPdf({
    html,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595, // A4 width in points
    pageHeight: 842, // A4 height in points
    margins: { top: 50, right: 50, bottom: 50, left: 50 }
  });

  const outPath = resolve("tests", "out-background-shorthand.pdf");
  writeFileSync(outPath, pdfBuffer);

  // Convert to a 1:1 byte string so ASCII operators are findable.
  const raw = readFileSync(outPath).toString("latin1");

  // Pure blue (#0000FF) in device RGB is "0 0 1".
  // We expect:
  //  - non-stroking fill color: "0 0 1 rg"
  //  - stroking color (border): "0 0 1 RG"
  // - at least one rectangle + fill: "re" followed by "f"
  const hasFillBlue = raw.includes("0 0 1 rg");
  const hasStrokeBlue = raw.includes("0 0 1 RG");
  const hasRect = raw.includes(" re");
  const hasFill = raw.includes("\nf") || raw.includes(" f");

  // Simple assertions (throw on failure)
  if (!hasFillBlue) {
    throw new Error("Expected non-stroking blue fill (\"0 0 1 rg\") not found in PDF stream.");
  }
  if (!hasRect) {
    throw new Error("Expected rectangle operator (\"re\") not found in PDF stream.");
  }
  if (!hasFill) {
    throw new Error("Expected fill operator (\"f\") not found in PDF stream.");
  }
  if (!hasStrokeBlue) {
    // Not strictly required for background color, but we set border to same blue;
    // warn if missing so you can check border pathing.
    console.warn('WARN: stroking color "0 0 1 RG" not found. Border may not be emitted as expected.');
  }

  console.log("OK: background shorthand produced a blue fill in PDF (operators found).");
  
  // Also test the longhand version for parity
  await testLonghandVersion();
}

async function testLonghandVersion() {
  const htmlLonghand = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
.box{width:300px;height:200px;background-color:#0000ff;border:5px solid #0000ff;}
</style></head><body><div class="box"></div></body></html>`;

  const pdfBuffer = await renderHtmlToPdf({
    html: htmlLonghand,
    css: "",
    viewportWidth: 800,
    viewportHeight: 600,
    pageWidth: 595, // A4 width in points
    pageHeight: 842, // A4 height in points
    margins: { top: 50, right: 50, bottom: 50, left: 50 }
  });

  const outPath = resolve("tests", "out-background-longhand.pdf");
  writeFileSync(outPath, pdfBuffer);

  // Convert to a 1:1 byte string so ASCII operators are findable.
  const raw = readFileSync(outPath).toString("latin1");

  // Pure blue (#0000FF) in device RGB is "0 0 1".
  const hasFillBlue = raw.includes("0 0 1 rg");
  const hasStrokeBlue = raw.includes("0 0 1 RG");
  const hasRect = raw.includes(" re");
  const hasFill = raw.includes("\nf") || raw.includes(" f");

  // Simple assertions (throw on failure)
  if (!hasFillBlue) {
    throw new Error("Expected non-stroking blue fill (\"0 0 1 rg\") not found in PDF stream (longhand version).");
  }
  if (!hasRect) {
    throw new Error("Expected rectangle operator (\"re\") not found in PDF stream (longhand version).");
  }
  if (!hasFill) {
    throw new Error("Expected fill operator (\"f\") not found in PDF stream (longhand version).");
  }
  if (!hasStrokeBlue) {
    console.warn('WARN: stroking color "0 0 1 RG" not found in longhand version. Border may not be emitted as expected.');
  }

  console.log("OK: background-color longhand also produced a blue fill in PDF (operators found).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
