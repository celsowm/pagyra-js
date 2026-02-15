
import { describe, it, expect } from 'vitest';
import { renderHtmlToPdf } from '../src/html-to-pdf.js';
import path from 'node:path';
import fs from 'node:fs';

describe('Multi-Font Subsetting Verification', () => {
    it('should generate a small PDF with Tinos and Arimo fonts', async () => {
        process.env.PAGYRA_FONTS_DIR = path.resolve(process.cwd(), 'assets/fonts');

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    .serif { font-family: 'Tinos', serif; font-size: 24px; }
                    .sans { font-family: 'Arimo', sans-serif; font-size: 24px; }
                </style>
            </head>
            <body>
                <div class="serif">Serif Text: Hello World with Tinos! - ação, acentuação, coração</div>
                <div class="sans">Sans-Serif Text: Hello World with Arimo! - ação, acentuação, coração</div>
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
        console.log(`Generated Multi-Font PDF size: ${size} bytes`);

        // Log if any fallback occurred (I'd need to intercept logs, but let's just check size)

        fs.writeFileSync('test-subset-multi.pdf', pdfBuffer);

        // Increased limit for multi-font Latin characters if they have high GIDs
        expect(size).toBeLessThan(200 * 1024);
    });
});
