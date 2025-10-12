const WIN_ANSI_UNICODE = (() => {
  const table: number[] = new Array(256);
  for (let code = 0; code <= 0xff; code++) {
    table[code] = code;
  }

  const overrides: Record<number, number> = {
    0x80: 0x20ac,
    0x82: 0x201a,
    0x83: 0x0192,
    0x84: 0x201e,
    0x85: 0x2026,
    0x86: 0x2020,
    0x87: 0x2021,
    0x88: 0x02c6,
    0x89: 0x2030,
    0x8a: 0x0160,
    0x8b: 0x2039,
    0x8c: 0x0152,
    0x8e: 0x017d,
    0x91: 0x2018,
    0x92: 0x2019,
    0x93: 0x201c,
    0x94: 0x201d,
    0x95: 0x2022,
    0x96: 0x2013,
    0x97: 0x2014,
    0x98: 0x02dc,
    0x99: 0x2122,
    0x9a: 0x0161,
    0x9b: 0x203a,
    0x9c: 0x0153,
    0x9e: 0x017e,
    0x9f: 0x0178,
  };

  for (const [codePoint, unicode] of Object.entries(overrides)) {
    const code = Number(codePoint);
    table[code] = unicode;
  }

  return table;
})();

const UNICODE_TO_WIN_ANSI = (() => {
  const map = new Map<number, number>();
  for (let code = 0; code <= 0xff; code++) {
    const unicode = WIN_ANSI_UNICODE[code];
    if (!map.has(unicode)) {
      map.set(unicode, code);
    }
  }
  return map;
})();

export function encodeToWinAnsi(text: string): string {
  let result = "";
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    const byte = UNICODE_TO_WIN_ANSI.get(codePoint);
    if (byte === undefined) {
      result += "?";
      continue;
    }
    result += String.fromCharCode(byte);
  }
  return result;
}

export function escapePdfLiteral(text: string): string {
  return text.replace(/([()\\])/g, "\\$1");
}

export function encodeAndEscapePdfText(text: string): string {
  return escapePdfLiteral(encodeToWinAnsi(text));
}
