import { describe, it, expect } from 'vitest';
import { FontOrchestrator, detectFontFormat } from '../../src/fonts/index.js';
import fs from 'node:fs/promises';

describe('Font Orchestrator', () => {
  const orchestrator = new FontOrchestrator();

  it('rejects invalid WOFF signature', async () => {
    const invalidData = new Uint8Array([0x77, 0x4f, 0x46, 0x31]); // wOF1
    await expect(orchestrator.parseFont(invalidData)).rejects.toThrow('Unsupported font format');
  });

  it('rejects WOFF too short', async () => {
    const shortData = new Uint8Array(43);
    shortData.set(new TextEncoder().encode('wOFF'), 0);
    await expect(orchestrator.parseFont(shortData)).rejects.toThrow('Invalid WOFF: file too short');
  });

  it('parses real Lato WOFF correctly', async () => {
    const buffer = await fs.readFile('assets/fonts/woff/lato/lato-latin-400-normal.woff');
    const fontData = new Uint8Array(buffer);

    const font = await orchestrator.parseFont(fontData);

    // Should be detected as WOFF format
    expect(detectFontFormat(fontData)).toBe('woff');

    // LoadedFont interface (via UnifiedFont alias)
    expect(font.program.sourceFormat).toBe('woff');
    expect(font.metrics).toBeDefined();
    expect(font.metrics.glyphMetrics).toBeDefined();
    expect(font.metrics.cmap).toBeDefined();
    expect(font.metrics.metrics.unitsPerEm).toBeGreaterThan(0);

    // Raw table data should be available for WOFF
    expect(font.program.getRawTableData).toBeDefined();
    expect(font.program.getRawTableData!('head')).toBeDefined();
    expect(font.program.getRawTableData!('hhea')).toBeDefined();
    expect(font.program.getRawTableData!('maxp')).toBeDefined();
    expect(font.program.getRawTableData!('head')!.length).toBe(54);
  });

  it('rejects invalid WOFF2 signature', async () => {
    // Data that would be detected as WOFF2 but is invalid internally
    const invalidData = new Uint8Array(48);
    // Set up minimal WOFF2 structure but make it invalid
    invalidData.set(new TextEncoder().encode('wOF2'), 0);
    await expect(orchestrator.parseFont(invalidData)).rejects.toThrow();
  });

  it('rejects WOFF2 too short', async () => {
    const shortData = new Uint8Array(47);
    shortData.set(new TextEncoder().encode('wOF2'), 0);
    await expect(orchestrator.parseFont(shortData)).rejects.toThrow('Invalid WOFF2: file too short');
  });

  it('detects supported formats correctly', () => {
    // TTF detection
    const ttfData = new Uint8Array([0x00, 0x01, 0x00, 0x00]);
    expect(detectFontFormat(ttfData)).toBe('ttf');

    // WOFF detection
    const woffData = new TextEncoder().encode('wOFF');
    expect(detectFontFormat(woffData)).toBe('woff');

    // WOFF2 detection
    const woff2Data = new TextEncoder().encode('wOF2');
    expect(detectFontFormat(woff2Data)).toBe('woff2');

    // Invalid format
    const invalidData = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
    expect(detectFontFormat(invalidData)).toBeNull();
  });
});
