import { describe, expect, it } from 'vitest';
import { PdfDocument } from '../../src/pdf/primitives/pdf-document.js';

describe('PDF page tree parent links', () => {
  it('emits a /Parent reference on each leaf /Page (including multiple pages)', () => {
    const document = new PdfDocument();
    document.addPage({ width: 595, height: 842, contents: '' });
    document.addPage({ width: 595, height: 842, contents: '' });

    const bytes = document.finalize();
    const pdf = Buffer.from(bytes).toString('latin1');

    const pagesTree = /(\d+) 0 obj\s*<<\s*\/Type \/Pages\b[\s\S]*?\/Kids \[([^\]]*)\]/.exec(pdf);
    expect(pagesTree).not.toBeNull();
    const parentId = pagesTree![1];
    const leaves = [...pdf.matchAll(/(\d+) 0 obj\s*<<\s*\/Type \/Page\b\s*\/Parent (\d+) 0 R/g)];
    expect(leaves).toHaveLength(2);
    for (const page of leaves) {
      expect(page[2]).toBe(parentId);
      expect(pagesTree![2]).toContain(`${page[1]} 0 R`);
    }
  });
});
