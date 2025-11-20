
import { renderHtmlToPdf } from './src/html-to-pdf.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const html = `<span>hello</span>`;

    console.log('Rendering repro...');

    try {
        await renderHtmlToPdf({
            html,
            css: '',
            viewportWidth: 800,
            viewportHeight: 600,
            pageWidth: 800,
            pageHeight: 600,
            margins: { top: 0, right: 0, bottom: 0, left: 0 },
            debug: false,
            resourceBaseDir: __dirname,
            assetRootDir: path.join(__dirname, 'playground', 'public'),
        });
        console.log('Render finished.');
    } catch (e) {
        console.error(e);
    }
}

main();
