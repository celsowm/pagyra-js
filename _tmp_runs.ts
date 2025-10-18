import { prepareHtmlRender } from './src/html-to-pdf.js';
import { Run } from './src/pdf/types.js';
const html = await (await import('fs/promises')).readFile('playground/public/examples/justify-text.html', 'utf8');
const { renderTree } = prepareHtmlRender({ html, css: '', viewportWidth: 800, viewportHeight: 1000, pageWidth: 800, pageHeight: 1000, margins: { top: 0, right: 0, bottom: 0, left: 0 } });
function collect(box): Run[] {
  const runs: Run[] = [...box.textRuns];
  for (const child of box.children) runs.push(...collect(child));
  return runs;
}
console.log(collect(renderTree.root).map(run => ({ text: run.text, wordSpacing: run.wordSpacing })));
