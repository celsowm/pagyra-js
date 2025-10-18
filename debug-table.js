import { prepareHtmlRender } from './src/html-to-pdf.js';

async function debugTable() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Test</title></head>
    <body>
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
        <tr>
          <td>Row 3, Cell 1</td>
          <td>Row 3, Cell 2</td>
          <td>Row 3, Cell 3</td>
        </tr>
      </tbody>
    </table>
    </body>
    </html>
  `;

  try {
    // Let's debug the DOM parsing first
    const { parseHTML } = await import('linkedom');
    const { document } = parseHTML(html);
    console.log('=== DOM DEBUG ===');
    console.log('Document body:', !!document.body);
    console.log('Body children:', document.body?.children?.length || 0);

    for (let i = 0; i < document.body?.children?.length; i++) {
      const child = document.body.children[i];
      console.log(`Body child ${i}:`, {
        tagName: child.tagName,
        nodeType: child.nodeType,
        childNodes: child.childNodes?.length || 0
      });
    }

    const prepared = await prepareHtmlRender({
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

    console.log('=== DEBUG INFO ===');
    console.log('Root layout children:', prepared.layoutRoot.children.length);

    prepared.layoutRoot.children.forEach((child, index) => {
      console.log(`Child ${index}:`, {
        tagName: child.tagName,
        display: child.style.display,
        contentWidth: child.box.contentWidth,
        contentHeight: child.box.contentHeight,
        borderBoxWidth: child.box.borderBoxWidth,
        borderBoxHeight: child.box.borderBoxHeight,
        children: child.children.length
      });

      if (child.children.length > 0) {
        child.children.forEach((grandChild, gIndex) => {
          console.log(`  GrandChild ${gIndex}:`, {
            tagName: grandChild.tagName,
            display: grandChild.style.display,
            contentWidth: grandChild.box.contentWidth,
            contentHeight: grandChild.box.contentHeight,
            borderBoxWidth: grandChild.box.borderBoxWidth,
            borderBoxHeight: grandChild.box.borderBoxHeight,
            children: grandChild.children.length
          });
        });
      }
    });

    console.log('Final root dimensions:', {
      contentWidth: prepared.layoutRoot.box.contentWidth,
      contentHeight: prepared.layoutRoot.box.contentHeight,
      borderBoxWidth: prepared.layoutRoot.box.borderBoxWidth,
      borderBoxHeight: prepared.layoutRoot.box.borderBoxHeight
    });

  } catch (error) {
    console.error('Error in debug:', error);
  }
}

debugTable();
