import type { ViewportPx } from '../types/public.js';

export interface UnitCtx { viewport: ViewportPx; }

export function pxToPt(px: number) { return px * 72 / 96; }
export function ptToPx(pt: number) { return pt * 96 / 72; }

export function parseLengthWithViewport(input: string, ctx: UnitCtx): number | undefined {
  const s = input.trim();
  if (s.endsWith('px')) return parseFloat(s);
  if (s.endsWith('pt')) return ptToPx(parseFloat(s));
  if (s.endsWith('vw')) return (parseFloat(s) / 100) * ctx.viewport.width;
  if (s.endsWith('vh')) return (parseFloat(s) / 100) * ctx.viewport.height;
  if (/^-?\d+(\.\d+)?$/.test(s)) return parseFloat(s); // unitless: treat as px by default
  return undefined;
}

export function makeUnitParsers(ctx: UnitCtx) {
  return {
    pxToPt, ptToPx,
    parseLength: (v: string) => parseLengthWithViewport(v, ctx),
  };
}

export type UnitParsers = ReturnType<typeof makeUnitParsers>;
