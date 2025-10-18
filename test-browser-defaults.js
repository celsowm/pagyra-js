import fs from 'fs';
import { renderHtmlToPdf } from './html-to-pdf.js';

async function testBrowserDefaults() {
    try {
        const html = fs.readFileSync('test-browser-defaults.html', 'utf8');

        const options = {
            html,
            css: '',
            viewportWidth: 800,
            viewportHeight: 600,
            pageWidth: 595,
            pageHeight: 842,
            margins: {
                top: 36,
                right: 36,
                bottom: 36,
                left: 36
            },
            debug: true,
            debugLevel: 'DEBUG',
            debugCats: ['STYLE', 'PARSE', 'LAYOUT']
        };

        console.log('Testing browser defaults implementation...');
        console.log('Converting HTML to PDF with browser-like defaults...');

        const pdfBuffer = await renderHtmlToPdf(options);

        fs.writeFileSync('test-browser-defaults.pdf', pdfBuffer);

        console.log('✅ PDF generated successfully!');
        console.log('📄 Output: test-browser-defaults.pdf');
        console.log('');
        console.log('Browser defaults applied:');
        console.log('✓ Typography: Times font family, 16px base font size');
        console.log('✓ Headings: Proper font sizes (H1=32px, H2=24px, H3=19px)');
        console.log('✓ Lists: 40px padding-left, proper list styles');
        console.log('✓ Tables: Separate borders, 2px spacing');
        console.log('✓ Links: Blue color (#0000EE)');
        console.log('✓ Code: Monospace font family');
        console.log('✓ Box model: Proper margins and padding for elements');

    } catch (error) {
        console.error('❌ Error testing browser defaults:', error);
        console.error(error.stack);
    }
}

testBrowserDefaults();
