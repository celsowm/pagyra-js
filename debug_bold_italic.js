import { readFile, writeFile } from "fs/promises";
import { renderHtmlToPdf } from "./dist/html-to-pdf.js";

async function testBoldItalicConversion() {
  try {
    const html = await readFile("debug_bold_italic.html", "utf-8");
    
    console.log("=== TESTING BOLD/ITALIC CONVERSION ===");
    console.log("Input HTML:");
    console.log(html);
    console.log("\n=== CONVERTING TO PDF ===");
    
    const pdf = await renderHtmlToPdf({
      html,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 595,
      pageHeight: 842,
      margins: { top: 50, right: 50, bottom: 50, left: 50 }
    });
    
    await writeFile("debug_bold_italic.pdf", pdf);
    console.log("Generated: debug_bold_italic.pdf");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testBoldItalicConversion();
