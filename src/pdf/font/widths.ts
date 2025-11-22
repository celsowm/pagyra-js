import type { TtfFontMetrics } from "../../types/fonts.js";

/**
 * Compute DW (default width) and compressed W array from glyph metrics.
 * Shared utility used by font embedding and tests.
 */
export function computeWidths(metrics: TtfFontMetrics): { DW: number; W: (number | number[])[] } {
  const count = metrics.glyphMetrics.size;
  const widths: number[] = new Array(count).fill(0);
  for (const [gid, gm] of metrics.glyphMetrics) {
    widths[gid] = Math.round((gm.advanceWidth / metrics.metrics.unitsPerEm) * 1000);
  }

  const computeDW = (arr: number[]) => {
    const freq = new Map<number, number>();
    for (const v of arr) {
      // Skip zero widths; a DW of 0 breaks Identity-H rendering in some viewers.
      if (v === 0) continue;
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
    // Fallback to 1000 if we only saw zeros.
    if (freq.size === 0) {
      return 1000;
    }
    let best = 1000;
    let bestCount = -1;
    for (const [v, c] of freq.entries()) {
      if (c > bestCount || (c === bestCount && v < best)) {
        best = v;
        bestCount = c;
      }
    }
    return best;
  };

  const DW = computeDW(widths);

  // Compress widths into W entries using ranges for repeating values and arrays for heterogenous runs
  // The PDF spec requires a flat array of mixed types:
  // c [w1 w2 ... wn]
  // c_first c_last w
  const result: (number | number[])[] = [];
  let i = 0;
  while (i < count) {
    // skip DW values
    if (widths[i] === DW) {
      i++;
      continue;
    }

    // try find long run of identical width (use range if length >= 4)
    const start = i;
    const val = widths[i];
    let j = i + 1;
    while (j < count && widths[j] === val) j++;
    const runLen = j - start;
    if (runLen >= 4) {
      // c_first c_last w
      result.push(start);
      result.push(j - 1);
      result.push(val);
      i = j;
      continue;
    }

    // otherwise build a heterogenous list until we hit DW or reach a reasonable chunk (32)
    const listStart = i;
    const list: number[] = [];
    while (i < count && widths[i] !== DW && list.length < 32) {
      list.push(widths[i]);
      i++;
    }
    // c [w1 ... wn]
    result.push(listStart);
    result.push(list);
  }

  return { DW, W: result };
}
