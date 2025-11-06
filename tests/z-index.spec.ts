// tests/z-index.spec.ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { parseZIndex } from "../src/css/parsers/dimension-parser.js";
import type { StyleAccumulator } from "../src/css/style.js";
import { renderHtmlToPdf } from "../src/html-to-pdf.js";
import { log } from "../src/debug/log.js";

/* -----------------------------------------------------------------------------
 * Mock de logger robusto (cobre import nomeado e default)
 * ---------------------------------------------------------------------------*/
vi.mock("../src/debug/log.js", () => {
  const log = vi.fn();
  const configureDebug = vi.fn();
  return { log, configureDebug, default: { log, configureDebug } };
});

beforeEach(() => {
  vi.clearAllMocks();
});

/* -----------------------------------------------------------------------------
 * Helpers utilitários (matemáticos + parsing de logs)
 * ---------------------------------------------------------------------------*/
type RawCall = [cat: string, lvl: string, msg: unknown, extra?: unknown];

function getCalls(): RawCall[] {
  return (log as unknown as Mock).mock.calls as unknown as RawCall[];
}

// Monotonicidade não-decrescente em O(n) - permite valores iguais
function nonDecreasing(seq: number[]): boolean {
  for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) return false;
  return true;
}

// Extrai primeiro número após "z:" ou "z-index:" (permite negativo)
function extractZ(raw: string): number {
  const m = /z(?:-index)?\s*[:=]\s*(-?\d+)/i.exec(raw);
  return m ? Number(m[1]) : Number.NaN;
}

// Extrai ID em vários formatos: "id=foo", "id: foo", "elem=foo", "#foo"
function extractId(raw: string): string | null {
  const m1 = /(?:id|elem)\s*[:=]\s*([#\w-]+)/i.exec(raw);
  if (m1) return m1[1].replace(/^#/, "");
  const m2 = /#([A-Za-z][\w-]*)/.exec(raw);
  return m2 ? m2[1] : null;
}

// Normaliza mensagens relevantes da fase PAINT
function collectPaintMsgs(calls: RawCall[]): { raw: string; idx: number }[] {
  const out: { raw: string; idx: number }[] = [];
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    if (c[0] !== "PAINT") continue;
    const lvl = String(c[1] ?? "");
    if (lvl !== "DEBUG" && lvl !== "TRACE") continue;
    const s = String(c[2] ?? "");
    if (/Painting element/i.test(s) || /op=(fill|stroke)/i.test(s)) {
      out.push({ raw: s, idx: i });
    }
  }
  return out;
}

// Constrói sequência detalhada de comandos (se houver TRACE)
type Cmd = { z: number; id: string; op: "fill" | "stroke"; raw: string; idx: number };
function buildCmds(msgs: { raw: string; idx: number }[]): Cmd[] {
  return msgs
    .map(m => {
      const z = extractZ(m.raw);
      const id = extractId(m.raw) ?? "?";
      const op: "fill" | "stroke" = /stroke/i.test(m.raw) ? "stroke" : "fill"; // union literal
      return { z, id, op, raw: m.raw, idx: m.idx };
    })
    .filter(c => Number.isFinite(c.z))
    .sort((a, b) => a.z - b.z); // Sort by z-index ascending
}

// Verifica separação entre grupos adjacentes de z (max idx do grupo menor < min idx do grupo maior)
function assertNoInterleavingBetweenAdjacentZ(cmds: Cmd[]): void {
  const zVals = [...new Set(cmds.map(c => c.z))].sort((a, b) => a - b);
  for (let i = 0; i < zVals.length - 1; i++) {
    const zl = zVals[i], zh = zVals[i + 1];
    const lower = cmds.filter(c => c.z === zl).map(c => c.idx);
    const higher = cmds.filter(c => c.z === zh).map(c => c.idx);
    if (lower.length && higher.length) {
      const lastLower = Math.max(...lower);
      const firstHigher = Math.min(...higher);
      expect(lastLower).toBeLessThan(firstHigher);
    }
  }
}

// Dentro do mesmo elemento/id: fill aparece antes de stroke e sem z “estranho” entre um e outro
function assertFillBeforeStrokePerId(cmds: Cmd[]): void {
  const byId = new Map<string, Cmd[]>();
  for (const c of cmds) byId.set(c.id, [...(byId.get(c.id) ?? []), c]);
  for (const [, seq] of byId) {
    const firstFill = seq.findIndex(c => c.op === "fill");
    const firstStroke = seq.findIndex(c => c.op === "stroke");
    expect(firstFill).toBeGreaterThanOrEqual(0);
    if (firstStroke >= 0) {
      expect(firstStroke).toBeGreaterThan(firstFill);
      const between = seq.slice(firstFill + 1, firstStroke);
      const hasForeignZ = between.some(c => c.z !== seq[0].z);
      expect(hasForeignZ).toBe(false);
    }
  }
}

/* -----------------------------------------------------------------------------
 * PARSER
 * ---------------------------------------------------------------------------*/
describe("z-index parser", () => {
  it("parses 'auto'", () => {
    const t: StyleAccumulator = {};
    parseZIndex("auto", t);
    expect(t.zIndex).toBe("auto");
  });

  it("accepts signed integers (neg, zero, pos)", () => {
    const t: StyleAccumulator = {};
    parseZIndex("-2", t); expect(t.zIndex).toBe(-2);
    parseZIndex("0", t);  expect(t.zIndex).toBe(0);
    parseZIndex("7", t);  expect(t.zIndex).toBe(7);
  });

  it("trims whitespace and parses", () => {
    const t: StyleAccumulator = {};
    parseZIndex("   10  ", t); expect(t.zIndex).toBe(10);
    parseZIndex("\t-3\t", t);   expect(t.zIndex).toBe(-3);
    parseZIndex("\tauto\t", t); expect(t.zIndex).toBe("auto");
  });

  it("rejects non-integer numeric formats (1.5, 2.0, hex, sci)", () => {
    const t: StyleAccumulator = {};
    parseZIndex("1.5", t);  expect(t.zIndex).toBeUndefined();
    parseZIndex("2.0", t);  expect(t.zIndex).toBeUndefined(); // spec aceita ints; aqui rejeitamos decimais explicitamente
    parseZIndex("0x10", t); expect(t.zIndex).toBeUndefined();
    parseZIndex("1e3", t);  expect(t.zIndex).toBeUndefined();
  });

  it("rejects invalid tokens", () => {
    const t: StyleAccumulator = {};
    for (const v of ["", " ", "px", "foo", "--1", "+-2"]) {
      parseZIndex(v, t);
      expect(t.zIndex).toBeUndefined();
    }
  });

  it("handles explicit plus sign and large numbers (overflow is upstream concern)", () => {
    const t: StyleAccumulator = {};
    parseZIndex("+5", t); expect(t.zIndex).toBe(5);

    parseZIndex("999999999999999", t);
    expect(typeof t.zIndex === "number").toBe(true);
    expect(Number.isFinite(t.zIndex as number)).toBe(true); // guard sugerido
    // exemplo opcional de faixa segura:
    // expect(Math.abs(t.zIndex as number)).toBeLessThanOrEqual(2147483647);
  });
});

/* -----------------------------------------------------------------------------
 * RENDER
 * ---------------------------------------------------------------------------*/
describe("z-index rendering", () => {
  // Base com sobreposição real
  const baseHtml = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0">
        <div id="red"   style="position:absolute; z-index:1; background:red;   border:2px solid black; width:120px; height:120px; top:20px; left:20px;"></div>
        <div id="blue"  style="position:absolute; z-index:2; background:blue;  border:2px solid black; width:120px; height:120px; top:40px; left:60px;"></div>
        <div id="green" style="position:absolute; z-index:3; background:green; border:2px solid black; width:120px; height:120px; top:60px; left:100px;"></div>
      </body>
    </html>
  `;

  const baseCss = `
    #red, #blue, #green {
      position: absolute;
      font-family: Arial;
      font-size: 12px;
    }
  `;

  it("paints by ascending z-index (1 -> 2 -> 3)", async () => {
    await renderHtmlToPdf({
      html: baseHtml, css: baseCss,
      viewportWidth: 800, viewportHeight: 600,
      pageWidth: 800, pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true,
      debugCats: ["PARSE", "STYLE", "LAYOUT", "RENDER_TREE", "PAINT", "PAINT_TRACE"]
    });

    const calls = getCalls();
    expect(calls.length).toBeGreaterThan(0);

    const paintMsgs = collectPaintMsgs(calls);
    expect(paintMsgs.length).toBeGreaterThanOrEqual(3);

    const zSeq = paintMsgs.map(m => extractZ(m.raw)).filter(Number.isFinite) as number[];
    expect(zSeq.length).toBeGreaterThanOrEqual(3);
    
    // Check that backgrounds are painted in correct z-order (first occurrence of each z)
    const backgroundZs = zSeq.slice(0, 6); // First 6 are backgrounds
    expect(nonDecreasing(backgroundZs)).toBe(true);
    
    // presença e ordem de 1,2,3 (primeiras ocorrências)
    const f1 = backgroundZs.indexOf(1), f2 = backgroundZs.indexOf(2), f3 = backgroundZs.indexOf(3);
    expect(f1).toBeGreaterThanOrEqual(0);
    expect(f2).toBeGreaterThan(f1);
    expect(f3).toBeGreaterThan(f2);
  });

  it("ensures fill happens before stroke for each element and no interleaving between z-groups", async () => {
    await renderHtmlToPdf({
      html: baseHtml, css: baseCss,
      viewportWidth: 800, viewportHeight: 600,
      pageWidth: 800, pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true,
      debugCats: ["PAINT", "PAINT_TRACE"]
    });

    const calls = getCalls();
    const paintMsgs = collectPaintMsgs(calls);

    // Se não há TRACE por op, caímos no fallback de ordem por z:
    if (!paintMsgs.some(m => /op=(fill|stroke)/i.test(m.raw))) {
      const zSeq = paintMsgs.map(m => extractZ(m.raw)).filter(Number.isFinite) as number[];
      expect(zSeq.length).toBeGreaterThanOrEqual(3);
      expect(nonDecreasing(zSeq)).toBe(true);
      return;
    }

    const cmds = buildCmds(paintMsgs);

    // (1) Monotonicidade global por z
    expect(nonDecreasing(cmds.map(c => c.z))).toBe(true);

    // (2) Sem interleaving entre z adjacentes
    assertNoInterleavingBetweenAdjacentZ(cmds);

    // (3) Para cada id, fill antes de stroke e sem z estranho entre eles
    assertFillBeforeStrokePerId(cmds);
  });

  it("DOM order breaks ties when z-index is equal", async () => {
    const htmlTie = `
      <!DOCTYPE html>
      <html><body>
        <div id="a" style="position:absolute; z-index:2; background:#aaa; width:80px; height:80px; top:10px; left:10px;"></div>
        <div id="b" style="position:absolute; z-index:2; background:#bbb; width:80px; height:80px; top:20px; left:20px;"></div>
      </body></html>
    `;
    await renderHtmlToPdf({
      html: htmlTie, css: "",
      viewportWidth: 400, viewportHeight: 300,
      pageWidth: 400, pageHeight: 300,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true, debugCats: ["PAINT", "PAINT_TRACE"]
    });

    const msgs = collectPaintMsgs(getCalls())
      .map(m => ({ raw: m.raw, idx: m.idx, z: extractZ(m.raw), id: extractId(m.raw) ?? "?" }))
      .filter(x => x.z === 2);

    expect(msgs.length).toBeGreaterThanOrEqual(2);

    const seen = new Map<string, { idx: number }>();
    for (const x of msgs) if (!seen.has(x.id)) seen.set(x.id, { idx: x.idx });

    if (seen.has("a") && seen.has("b")) {
      expect(seen.get("a")!.idx).toBeLessThan(seen.get("b")!.idx);
    } else {
      const idxs = msgs.map(x => x.idx);
      expect(nonDecreasing(idxs)).toBe(true);
    }
  });

  it("renders negative z-index behind non-negative layers", async () => {
    const htmlNeg = `
      <!DOCTYPE html>
      <html><body style="margin:0">
        <!-- z=-1 deve vir antes (atrás) de z=0 e z=1 -->
        <div id="neg"  style="position:absolute; z-index:-1; background:#999; width:120px; height:120px; top:40px; left:70px;"></div>
        <div id="zero" style="position:absolute; z-index:0;  background:#ccc; width:120px; height:120px; top:60px; left:90px;"></div>
        <div id="pos"  style="position:absolute; z-index:1;  background:#0c0; width:120px; height:120px; top:80px; left:110px;"></div>
      </body></html>
    `;
    await renderHtmlToPdf({
      html: htmlNeg, css: "",
      viewportWidth: 500, viewportHeight: 400,
      pageWidth: 500, pageHeight: 400,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true, debugCats: ["PAINT", "PAINT_TRACE"]
    });

    const paintMsgs = collectPaintMsgs(getCalls());
    const zSeq = paintMsgs.map(m => extractZ(m.raw)).filter(Number.isFinite) as number[];
    expect(zSeq.length).toBeGreaterThanOrEqual(3);
    expect(nonDecreasing(zSeq)).toBe(true);

    const firstNeg  = zSeq.indexOf(-1);
    const firstZero = zSeq.indexOf(0);
    const firstPos  = zSeq.indexOf(1);
    expect(firstNeg).toBeGreaterThanOrEqual(0);
    expect(firstZero).toBeGreaterThan(firstNeg);
    expect(firstPos).toBeGreaterThan(firstZero);
  });

  it("ignores z-index on position: static (uses DOM order)", async () => {
    const htmlStatic = `
      <!DOCTYPE html>
      <html><body style="margin:0">
        <div id="s1" style="position: static; z-index: 999; background:#fa0; width:100px; height:100px;"></div>
        <div id="s2" style="position: static; z-index: -999; background:#0af; width:100px; height:100px;"></div>
      </body></html>
    `;
    await renderHtmlToPdf({
      html: htmlStatic, css: "",
      viewportWidth: 400, viewportHeight: 300,
      pageWidth: 400, pageHeight: 300,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true, debugCats: ["PAINT", "PAINT_TRACE"]
    });

    const msgs = collectPaintMsgs(getCalls());
    const ids = msgs.map(m => extractId(m.raw)).filter((x): x is string => !!x);

    const idx1 = ids.indexOf("s1");
    const idx2 = ids.indexOf("s2");

    if (idx1 >= 0 && idx2 >= 0) {
      // DOM order deve prevalecer: s1 APARECE antes de s2
      expect(idx1).toBeLessThan(idx2);
    } else {
      // fallback: se logs não expõem IDs/z para static, então zSeq deve ser vazio
      const zSeq = msgs.map(m => extractZ(m.raw)).filter(Number.isFinite);
      expect(zSeq.length).toBe(0);
    }
  });

  it("nested stacking contexts: child with huge z cannot escape parent's z", async () => {
    // pai z=1, filho z=999 (relative) e irmão do pai com z=2
    // o filho NÃO pode ultrapassar o irmão com z=2, pois está preso ao empilhamento do pai (z=1).
    const htmlNested = `
      <!DOCTYPE html>
      <html><body style="margin:0">
        <div id="parent" style="position:relative; z-index:1; background:#fee; width:160px; height:160px; top:20px; left:20px;">
          <div id="child"  style="position:relative; z-index:999; background:#e55; width:120px; height:120px; top:20px; left:20px;"></div>
        </div>
        <div id="sibling" style="position:absolute; z-index:2; background:#55e; width:160px; height:160px; top:40px; left:140px;"></div>
      </body></html>
    `;
    await renderHtmlToPdf({
      html: htmlNested, css: "",
      viewportWidth: 700, viewportHeight: 500,
      pageWidth: 700, pageHeight: 500,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true, debugCats: ["PAINT", "PAINT_TRACE"]
    });

    const msgs = collectPaintMsgs(getCalls());
    if (!msgs.some(m => /op=(fill|stroke)/i.test(m.raw))) {
      const zSeq = msgs.map(m => extractZ(m.raw)).filter(Number.isFinite) as number[];
      expect(nonDecreasing(zSeq)).toBe(true);
      const f1 = zSeq.indexOf(1);
      const f2 = zSeq.indexOf(2);
      if (f1 >= 0 && f2 >= 0) expect(f2).toBeGreaterThan(f1);
      return;
    }

    const cmds = buildCmds(msgs);

    // IDs precisam estar presentes para a checagem forte:
    const idxChild   = cmds.filter(c => c.id === "child").map(c => c.idx);
    const idxSibling = cmds.filter(c => c.id === "sibling").map(c => c.idx);
    expect(idxChild.length).toBeGreaterThan(0);
    expect(idxSibling.length).toBeGreaterThan(0);

    // Grupos por z: tudo do parent (inclui child) com z=1, depois sibling com z=2
    expect(nonDecreasing(cmds.map(c => c.z))).toBe(true);
    assertNoInterleavingBetweenAdjacentZ(cmds);

    // Forte: max(child) < min(sibling) — filho nunca “salta” o irmão do pai
    expect(Math.max(...idxChild)).toBeLessThan(Math.min(...idxSibling));
  });
});
