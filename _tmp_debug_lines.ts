import { prepareHtmlRender } from './src/html-to-pdf.js';
const html = await (await import('fs/promises')).readFile('playground/public/examples/justify-text.html', 'utf8');
const { layoutRoot } = prepareHtmlRender({ html, css: '', viewportWidth: 800, viewportHeight: 1000, pageWidth: 800, pageHeight: 1000, margins: { top: 0, right: 0, bottom: 0, left: 0 } });
layoutRoot.walk(node => {
  if (node.lineBoxes) {
    console.log(node.lineBoxes.map(l => ({ text: l.text, width: l.width, spaceCount: l.spaceCount, target: l.targetWidth })));
  }
});
