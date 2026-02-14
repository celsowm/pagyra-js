import fs from 'fs';
import { renderHtmlToPdf } from './dist/src/html-to-pdf.js';
import { configureDebug } from './dist/src/logging/debug.js';

// Enable debug logging
configureDebug({ level: 'debug', cats: ['font', 'encoding'] });

async function runConversion() {
    try {
        const htmlContent = fs.readFileSync('./test-arrow-playground.html', 'utf8');

        const pdfBuffer = await renderHtmlToPdf({
            html: htmlContent,
            css: '',
            viewportWidth: 800,
            viewportHeight: 600,
            pageWidth: 210 * 3.7795275591,
            pageHeight: 297 * 3.7795275591,
            margins: { top: 0, right: 0, bottom: 0, left: 0 },
        });

        fs.writeFileSync('./test-playground-result.pdf', pdfBuffer);
        console.log('✅ PDF saved to test-playground-result.pdf');
        console.log(`📄 File size: ${pdfBuffer.byteLength} bytes`);

    } catch (error) {
        console.error('❌ Error:', error);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

runConversion();
