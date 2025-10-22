import { describe, it, expect } from 'vitest';
import { renderHtmlToPdf } from '../src/html-to-pdf.js';

async function getPdfRaw(html: string): Promise<string> {
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
  return rawPdf;
}

describe('gradient-html', () => {
  it('should render a simple horizontal linear gradient', async () => {
    const html = `
      <div style="width: 200px; height: 80px; background: linear-gradient(to right, red, blue);"></div>
    `;
    const rawPdf = await getPdfRaw(html);

    // Check for the gradient pattern
    expect(rawPdf).toContain('/PatternType 2'); // Shading pattern
    expect(rawPdf).toContain('/ShadingType 2'); // Axial shading for linear gradients
    expect(rawPdf).toContain('/ColorSpace /DeviceRGB');
    
    // Check for color definitions
    expect(rawPdf).toContain('/C0 [ 1 0 0 ]'); // Red
    expect(rawPdf).toContain('/C1 [ 0 0 1 ]'); // Blue
  });

  it('should render a simple vertical linear gradient', async () => {
    const html = `
      <div style="width: 200px; height: 80px; background: linear-gradient(to bottom, yellow, green);"></div>
    `;
    const rawPdf = await getPdfRaw(html);

    // Check for the gradient pattern
    expect(rawPdf).toContain('/PatternType 2');
    expect(rawPdf).toContain('/ShadingType 2');
    expect(rawPdf).toContain('/ColorSpace /DeviceRGB');
    
    // Check for color definitions
    expect(rawPdf).toContain('/C0 [ 1 1 0 ]'); // Yellow
    expect(rawPdf).toContain('/C1 [ 0 0.50196 0 ]'); // Green
  });

  it('should render a diagonal linear gradient', async () => {
    const html = `
      <div style="width: 200px; height: 80px; background: linear-gradient(45deg, red, blue);"></div>
    `;
    const rawPdf = await getPdfRaw(html);

    // Check for the gradient pattern
    expect(rawPdf).toContain('/PatternType 2');
    expect(rawPdf).toContain('/ShadingType 2');
    expect(rawPdf).toContain('/ColorSpace /DeviceRGB');
    
    // Check for color definitions
    expect(rawPdf).toContain('/C0 [ 1 0 0 ]'); // Red
    expect(rawPdf).toContain('/C1 [ 0 0 1 ]'); // Blue
  });

  it('should render a linear gradient with multiple color stops', async () => {
    const html = `
      <div style="width: 200px; height: 80px; background: linear-gradient(to right, red, yellow 50%, blue);"></div>
    `;
    const rawPdf = await getPdfRaw(html);

    // Check for the gradient pattern
    expect(rawPdf).toContain('/PatternType 2');
    expect(rawPdf).toContain('/ShadingType 2');
    expect(rawPdf).toContain('/ColorSpace /DeviceRGB');
    
    // Check for function definition with multiple stops
    expect(rawPdf).toContain('/FunctionType 2');
    expect(rawPdf).toContain('/N 1');
  });

  it('should render a linear gradient with percentage stops', async () => {
    const html = `
      <div style="width: 200px; height: 80px; background: linear-gradient(to right, red 0%, yellow 50%, blue 100%);"></div>
    `;
    const rawPdf = await getPdfRaw(html);

    // Check for the gradient pattern
    expect(rawPdf).toContain('/PatternType 2');
    expect(rawPdf).toContain('/ShadingType 2');
    expect(rawPdf).toContain('/ColorSpace /DeviceRGB');
    
    // Check for function definition with multiple stops
    expect(rawPdf).toContain('/FunctionType 2');
    expect(rawPdf).toContain('/N 1');
  });
});
