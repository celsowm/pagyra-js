
import { describe, it, expect } from 'vitest';
import { renderHtmlToPdf } from '../src/html-to-pdf.js';
import path from 'node:path';
import fs from 'node:fs';

describe('Font Subsetting Verification', () => {
    it('should generate a small PDF with Tinos font', async () => {
        // Point to assets relative to CWD (project root)
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

        const pdfBuffer = await renderHtmlToPdf({
            html,
            pageWidth: 600,
            pageHeight: 800,
            assetRootDir: path.resolve(process.cwd(), 'assets')
        });

        const size = pdfBuffer.byteLength;
        console.log(`Generated PDF size: ${size} bytes`);

        fs.writeFileSync('test-subset-tinos.pdf', pdfBuffer);

        // Subsetting "Hello World..." should be very small (< 50KB)
        // Full font is ~2MB
        expect(size).toBeLessThan(50 * 1024);
    });
});
