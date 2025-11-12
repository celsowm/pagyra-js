import { expect, test } from 'vitest';
import { buildLineBoxes } from '../../src/layout/inline/line_breaker.js';

const measurer = (monoW: number) => (text: string) => ({
  width: text.length * monoW, ascent: 8, descent: 2, lineHeight: 16
});

test('Row 3, Cell 3 fits on one line inside td', () => {
  const style = {
    fontFamily: 'Helvetica',
    fontSizePx: 12,
    lineHeightPx: 19.2,
    whiteSpace: 'normal' as const
  };

  const text = 'Row 3, Cell 3';

  // width deliberately generous so it should not wrap
  const avail = 1000;

  const lines = buildLineBoxes(text, style, avail, (t,_f,_s,_w,_i)=>measurer(6)(t));
  expect(lines.length).toBe(1);
  expect(lines[0].text.trim()).toBe('Row 3, Cell 3');
});
