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
        { name: 'Roboto', family: 'Roboto', weight: 400, style: 'normal', src: './assets/fonts/ttf/roboto/Roboto-Regular.ttf' },
      ],
      defaultStack: ['Roboto'],
    },
  });
  return new TextDecoder('latin1').decode(pdfBytes);
}

const rx = (s: string) => new RegExp(s.replace(/\s+/g, '\\s+'));
const f = (n: number, tol = 0.005) =>
  new RegExp(String.raw`\b${(n - tol).toFixed(3)}\d*|\b${n.toFixed(3)}\d*|\b${(n + tol).toFixed(3)}\d*`);

describe('gradient-html', () => {
  it('renders horizontal linear gradient (two stops)', async () => {
    const html = `<div style="width:200px;height:80px;background:linear-gradient(to right, red, blue)"></div>`;
    const raw = await getPdfRaw(html);

    // Deve existir um Shading axial
    expect(raw).toMatch(rx(`/ShadingType\\s+2`));

    // ColorSpace pode ser DeviceRGB ou ICCBased; aceitamos ambos
    expect(raw).toMatch(/\/ColorSpace\s+\/(DeviceRGB|ICCBased)/);

    // Para 2 stops: função exponencial (Type 2) com C0/C1 ~ (1,0,0) -> (0,0,1)
    // Use regex tolerante a float/espaçamento.
    expect(raw).toMatch(rx(`/FunctionType\\s+2`));
    expect(raw).toMatch(rx(`/C0\\s*\\[\\s*${f(1).source}\\s+${f(0).source}\\s+${f(0).source}\\s*\\]`));
    expect(raw).toMatch(rx(`/C1\\s*\\[\\s*${f(0).source}\\s+${f(0).source}\\s+${f(1).source}\\s*\\]`));
  });

  it('renders vertical linear gradient (two stops, yellow→green)', async () => {
    const html = `<div style="width:200px;height:80px;background:linear-gradient(to bottom, yellow, green)"></div>`;
    const raw = await getPdfRaw(html);

    expect(raw).toMatch(rx(`/ShadingType\\s+2`));
    expect(raw).toMatch(/\/ColorSpace\s+\/(DeviceRGB|ICCBased)/);

    // yellow ≈ (1,1,0), green CSS ≈ (0, 0.50196, 0)
    expect(raw).toMatch(rx(`/FunctionType\\s+2`));
    expect(raw).toMatch(rx(`/C0\\s*\\[\\s*${f(1).source}\\s+${f(1).source}\\s+${f(0).source}\\s*\\]`));
    expect(raw).toMatch(rx(`/C1\\s*\\[\\s*${f(0).source}\\s+${f(0.502).source}\\s+${f(0).source}\\s*\\]`));
  });

  it('renders diagonal 45deg (two stops)', async () => {
    const html = `<div style="width:200px;height:80px;background:linear-gradient(45deg, red, blue)"></div>`;
    const raw = await getPdfRaw(html);

    expect(raw).toMatch(rx(`/ShadingType\\s+2`));
    expect(raw).toMatch(/\/ColorSpace\s+\/(DeviceRGB|ICCBased)/);
    // Não exigimos /PatternType 2 porque alguns writers usam sh direto
    // Mantemos checagem de função simples também
    expect(raw).toMatch(rx(`/FunctionType\\s+2`));
  });

  it('renders linear gradient with multiple color stops (stitching)', async () => {
    const html = `<div style="width:200px;height:80px;background:linear-gradient(to right, red, yellow 50%, blue)"></div>`;
    const raw = await getPdfRaw(html);

    expect(raw).toMatch(rx(`/ShadingType\\s+2`));
    expect(raw).toMatch(/\/ColorSpace\s+\/(DeviceRGB|ICCBased)/);

    // Para 3 stops espere uma função de costura (Type 3) com subfunções (Type 2)
    expect(raw).toMatch(rx(`/FunctionType\\s+3`));
    expect(raw).toMatch(rx(`/Functions\\s*\\[`)); // array de subfunções
    expect(raw).toMatch(rx(`/Bounds\\s*\\[`));    // pontos de corte (ex.: 0.5)
    // Opcional: verificar que ao menos uma subfunção é Type 2
    expect(raw).toMatch(rx(`/FunctionType\\s+2`));
  });

  it('renders gradient with explicit % stops (stitching)', async () => {
    const html = `<div style="width:200px;height:80px;background:linear-gradient(to right, red 0%, yellow 50%, blue 100%)"></div>`;
    const raw = await getPdfRaw(html);

    expect(raw).toMatch(rx(`/ShadingType\\s+2`));
    expect(raw).toMatch(/\/ColorSpace\s+\/(DeviceRGB|ICCBased)/);
    expect(raw).toMatch(rx(`/FunctionType\\s+3`));
    expect(raw).toMatch(rx(`/Functions\\s*\\[`));
    expect(raw).toMatch(rx(`/Bounds\\s*\\[`));
  });
});
