
export interface ShorthandDeps { parseLength: (v:string)=>number|null; }

export function expandBorderShorthand(val: string, deps: ShorthandDeps) {
  // move your existing border parsing logic here
  return { borderTopWidthPx: 0, borderRightWidthPx: 0, borderBottomWidthPx: 0, borderLeftWidthPx: 0 };
}

export function expandBorderRadius(val: string, deps: ShorthandDeps) {
  // move border-radius parser
  return { borderTopLeftRadiusPx:0, borderTopRightRadiusPx:0, borderBottomRightRadiusPx:0, borderBottomLeftRadiusPx:0 };
}

export function parseLineHeight(val: string, basePx: number) {
  // move your line-height normalize here
  if (/^\d+(\.\d+)?$/.test(val)) return parseFloat(val) * basePx; // unitless multiplier
  // else use units…
  return basePx * 1.2;
}
