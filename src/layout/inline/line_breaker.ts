export type MeasureFn = (
  text: string,
  fontFamily: string,
  fontSizePx: number,
  fontWeight?: number,
  fontStyle?: string
) => { width: number; ascent: number; descent: number; lineHeight: number };

export type LineBox = {
  text: string;
  width: number;
  ascent: number;
  descent: number;
  height: number; // = resolved line-height
};

export type ComputedStyle = {
  fontFamily: string;
  fontSizePx: number;
  fontWeight?: number;
  fontStyle?: string;
  lineHeightPx: number;
  whiteSpace?: 'normal'|'nowrap'|'pre'|'pre-wrap';
  overflowWrap?: 'normal'|'break-word'|'anywhere';
  wordBreak?: 'normal'|'break-all'|'keep-all';
};

export function tokenizeInline(text: string): string[] {
  // Keep spaces as tokens so we preserve gaps and can wrap before them
  // "Row 3, Cell 3" → ["Row"," ","3",","," ","Cell"," ","3"]
  const tokens: string[] = [];
  const re = /(\s+|[^\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) tokens.push(m[0]);
  return tokens;
}

export function buildLineBoxes(
  text: string,
  style: ComputedStyle,
  availWidthPx: number,
  measure: MeasureFn
): LineBox[] {
  const { fontFamily, fontSizePx, fontWeight, fontStyle, lineHeightPx,
          whiteSpace = 'normal', overflowWrap = 'normal', wordBreak = 'normal' } = style;

  // Short-circuit for nowrap
  if (whiteSpace === 'nowrap') {
    const m = measure(text, fontFamily, fontSizePx, fontWeight, fontStyle);
    return [{ text, width: m.width, ascent: m.ascent, descent: m.descent, height: lineHeightPx }];
  }

  const tokens = tokenizeInline(text);
  const lines: LineBox[] = [];

  let cur = '';
  let curW = 0;

  const push = (s: string) => {
    const m = measure(s, fontFamily, fontSizePx, fontWeight, fontStyle);
    lines.push({ text: s, width: m.width, ascent: m.ascent, descent: m.descent, height: lineHeightPx });
  };
  const w = (s: string) => measure(s, fontFamily, fontSizePx, fontWeight, fontStyle).width;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    // Handle explicit newlines in pre/pre-wrap
    if ((whiteSpace === 'pre' || whiteSpace === 'pre-wrap') && tok.includes('\n')) {
      const parts = tok.split(/(\n)/);
      for (const part of parts) {
        if (part === '\n') { push(cur); cur = ''; curW = 0; }
        else {
          const pw = w(part);
          if (!cur || curW + pw <= availWidthPx) { cur += part; curW += pw; }
          else { push(cur); cur = part; curW = pw; }
        }
      }
      continue;
    }

    const tokW = w(tok);

    if (!cur) {
      if (tokW <= availWidthPx) { cur = tok; curW = tokW; }
      else {
        // Oversized single token policy
        if (wordBreak === 'break-all' || overflowWrap === 'anywhere' || overflowWrap === 'break-word') {
          let chunk = '';
          for (const ch of tok) {
            const test = chunk + ch;
            if (w(test) > availWidthPx && chunk) { push(chunk); chunk = ch; }
            else chunk = test;
          }
          if (chunk) { cur = chunk; curW = w(chunk); }
        } else {
          cur = tok; curW = tokW; // allow overflow like browsers
        }
      }
      continue;
    }

    if (curW + tokW <= availWidthPx) { cur += tok; curW += tokW; }
    else { push(cur); cur = ''; curW = 0; i--; } // wrap before tok
  }

  if (cur !== '') push(cur);
  return lines.length ? lines : [{ text: '', width: 0, ascent: 0, descent: 0, height: lineHeightPx }];
}
