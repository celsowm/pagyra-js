import { renderHtmlToPdf } from './src/html-to-pdf.js';

async function debugGradient() {
  const html = `
    <div style="width: 200px; height: 80px; background: linear-gradient(to right, red, blue);"></div>
  `;
  
  console.log("Starting render...");
  const pdfBytes = await renderHtmlToPdf({
    html,
    css: '',
    viewportWidth: 230,
    viewportHeight: 100,
    pageWidth: 230,
    pageHeight: 100,
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    fontConfig: {
      fontFaceDefs: [
        {
          name: 'Roboto',
          family: 'Roboto',
          weight: 400,
          style: 'normal',
          src: './assets/fonts/Roboto-Regular.ttf',
        },
      ],
      defaultStack: ['Roboto'],
    },
  });

  // PDFs are binary, but the parts we are inspecting are ASCII/Latin1
  const decoder = new TextDecoder('latin1');
  const rawPdf = decoder.decode(pdfBytes);
  console.log("PDF content:", rawPdf);
}

debugGradient().catch(console.error);
