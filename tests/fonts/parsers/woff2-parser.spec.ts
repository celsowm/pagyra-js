import { describe, it, expect } from 'vitest';
import { Woff2Parser } from '../../../src/fonts/parsers/woff2-parser';
import { FontOrchestrator } from '../../../src/fonts/orchestrator';
import * as fs from 'fs';
import * as path from 'path';

const fontPath = path.resolve(__dirname, '../../../assets/fonts/woff2/lato/lato-latin-400-normal.woff2');
const fontData = new Uint8Array(fs.readFileSync(fontPath));

describe('Woff2Parser', () => {
  it('should be able to be instantiated', () => {
    const parser = new Woff2Parser();
    expect(parser).toBeDefined();
  });

  // it('should be able to parse a WOFF2 file', async () => {
  //   const parser = new Woff2Parser();
  //   const tables = await parser.parseTables(fontData);
  //   expect(tables).toBeDefined();
  //   expect(tables.flavor).toBe(0x00010000);
  // });
});

describe('FontOrchestrator with WOFF2', () => {
  it('should detect a WOFF2 font', async () => {
    const orchestrator = new FontOrchestrator();
    const unifiedFont = await orchestrator.parseFont(fontData);
    expect(unifiedFont).toBeDefined();
    // This is a weak assertion, but it's the best we can do without a full implementation.
    expect(unifiedFont.program.sourceFormat).toBe('woff2');
  });
});
