
import { renderHtmlToPdf } from '../src/html-to-pdf.js';
import path from 'node:path';
import fs from 'node:fs';

async function main() {
    process.env.PAGYRA_FONTS_DIR = path.resolve(process.cwd(), 'assets/fonts');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Tinos', serif; font-size: 24px; }
            </style>
        </head>
        <body>
            Hello World with Tinos!
        </body>
        </html>
    `;

    console.log("Starting renderHtmlToPdf...");
    try {
        const pdfBuffer = await renderHtmlToPdf({
            html,
            pageWidth: 600,
            pageHeight: 800,
            assetRootDir: path.resolve(process.cwd(), 'assets')
        });

        const size = pdfBuffer.byteLength;
        console.log(`Generated PDF size: ${size} bytes`);

        fs.writeFileSync('test-subset-tinos-standalone.pdf', pdfBuffer);

        if (size < 50 * 1024) {
            console.log("SUCCESS: PDF size is small!");
        } else {
            console.error("FAILURE: PDF size is too large!");
            process.exit(1);
        }
    } catch (e) {
        console.error("Render failed:", e);
        process.exit(1);
    }
}

main();
