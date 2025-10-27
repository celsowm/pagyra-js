import { htmlToPdf } from './dist/index.js';
import { writeFileSync } from 'fs';

async function testBulletFix() {
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Bullet Test</title>
</head>
<body>
    <h1>List Bullet Test</h1>
    <ul>
        <li>First item with bullet</li>
        <li>Second item with bullet</li>
        <li>Third item with bullet</li>
    </ul>
    
    <h2>Different List Styles</h2>
    <ul style="list-style-type: circle;">
        <li>Circle bullet item</li>
        <li>Another circle item</li>
    </ul>
    
    <ul style="list-style-type: square;">
        <li>Square bullet item</li>
        <li>Another square item</li>
    </ul>
    
    <ol>
        <li>Numbered item one</li>
        <li>Numbered item two</li>
        <li>Numbered item three</li>
    </ol>
</body>
</html>`;

  try {
    console.log('Generating PDF with bullet fix...');
    const pdfBuffer = await htmlToPdf(html, {
      format: 'A4',
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' }
    });
    
    writeFileSync('bullet_test_output.pdf', pdfBuffer);
    console.log('✅ PDF generated successfully: bullet_test_output.pdf');
    console.log('🎯 Bullets should now display correctly (not as "?")');
    
    return pdfBuffer;
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
}

testBulletFix();
