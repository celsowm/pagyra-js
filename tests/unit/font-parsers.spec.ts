import { describe, it, expect } from 'vitest';
import { parseWoff, parseWoff2 } from '../../src/fonts/index.js';
import fs from 'node:fs/promises';

describe('WOFF Font Parsers', () => {
  it('rejects invalid WOFF signature', async () => {
    const invalidData = new Uint8Array([0x77, 0x4f, 0x46, 0x31]); // wOF1
    await expect(parseWoff(invalidData)).rejects.toThrow('Invalid WOFF signature');
  });

  it('rejects WOFF too short', async () => {
    const shortData = new Uint8Array(43);
    shortData.set(new TextEncoder().encode('wOFF'), 0);
    await expect(parseWoff(shortData)).rejects.toThrow('Invalid WOFF: file too short');
  });

  it('parses real Lato WOFF correctly', async () => {
    const buffer = await fs.readFile('assets/fonts/woff/lato/lato-latin-400-normal.woff');
    const fontData = new Uint8Array(buffer);

    const font = await parseWoff(fontData);

    expect(font.flavor).toBe(0x00010000); // TrueType
    expect(font.numTables).toBeGreaterThan(0);
    expect(Object.keys(font.tables)).toHaveLength(font.numTables);
    expect(Object.keys(font.tables)).toContain('head');
    expect(Object.keys(font.tables)).toContain('hhea');
    expect(Object.keys(font.tables)).toContain('maxp');
    expect(font.tables.head.length).toBe(54);
  });

  it('rejects invalid WOFF2 signature', async () => {
    // Criar dados válidos até a assinatura, mas com assinatura inválida
    const invalidData = new Uint8Array(48);
    invalidData.set(new TextEncoder().encode('wOF2'), 0); // Assinatura válida
    invalidData[4] = 0x00; // flavor
    invalidData[8] = 0x00; // numTables
    invalidData[44] = 0x00; // reserved
    // Agora modificar para assinatura inválida
    invalidData[1] = 0x58; // xOF2
    await expect(parseWoff2(invalidData)).rejects.toThrow('Invalid WOFF2 signature');
  });

  it('rejects WOFF2 too short', async () => {
    const shortData = new Uint8Array(47);
    shortData.set(new TextEncoder().encode('wOF2'), 0);
    await expect(parseWoff2(shortData)).rejects.toThrow('Invalid WOFF2: file too short');
  });
});
