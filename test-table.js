import { renderHtmlToPdf } from './html-to-pdf.js';

async function testTable() {
  const html = `
    <table border='1' style='width: 100%; border-collapse: separate;'>
      <thead>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
          <th>Header 3</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Row 1, Cell 1</td>
          <td>Row 1, Cell 2</td>
          <td>Row 1, Cell 3</td>
        </tr>
        <tr>
          <td>Row 2, Cell 1</td>
          <td>Row 2, Cell 2</td>
          <td>Row 2, Cell 3</td>
        </tr>
      </tbody>
    </table>
  `;

  try {
    const pdf = await renderHtmlToPdf({
      html,
      css: '',
      viewportWidth: 800,
      viewportHeight: 600,
      pageWidth: 595,
      pageHeight: 842,
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
      debug: true,
      debugLevel: 'DEBUG',
      debugCats: ['PARSE', 'STYLE', 'LAYOUT', 'RENDER_TREE']
    });
    console.log('Table rendering successful! PDF size:', pdf.length, 'bytes');
  } catch (error) {
    console.error('Error rendering table:', error);
  }
}

testTable();
