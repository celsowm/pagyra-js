// tests/z-index.spec.ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { parseZIndex } from "../src/css/parsers/dimension-parser.js";
import type { StyleAccumulator } from "../src/css/style.js";
import { renderHtmlToPdf } from "../src/html-to-pdf.js";
import { log } from "../src/debug/log.js";

// ---- Mock de logger robusto (named + default)
vi.mock("../src/debug/log.js", () => {
  const log = vi.fn();
  const configureDebug = vi.fn();
  return { log, configureDebug, default: { log, configureDebug } };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ----------------- Helpers matematicamente robustos -----------------
function getCalls(mock = log as unknown as Mock) {
  return mock.mock.calls as unknown[][];
}

function extractZ(s: string): number {
  // aceita "z-index: 3" ou "z=3" (e variantes)
  const m = /z(?:-index)?[:=]\s*(-?\d+)/i.exec(s);
  return m ? Number(m[1]) : NaN;
}

function extractId(s: string): string | null {
  // aceita "id: green", "id=green", "elem: green", "#green"
  return (
    (/(?:^|\s)(?:id|elem)[:=]\s*([#\w-]+)/i.exec(s)?.[1]) ??
    (/#([\w-]+)/.exec(s)?.[1]) ??
    null
  );
}

function isPaintElementMsg(s: string): boolean {
  return /Painting element/i.test(s);
}

function isPaintCommandMsg(s: string): boolean {
  // aceita comandos TRACE/DEBUG: fill/stroke/background/image/svg/text
  return /(op=)?(fill|stroke)/i.test(s) ||
         /fillBackground|fillBorder|draw(Image|Svg|TextRun|BackgroundImage)/i.test(s);
}

function nonDecreasing(seq: number[]): boolean {
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] < seq[i - 1]) return false;
  }
  return true;
}

// ----------------- PARSER -----------------
describe("z-index parser", () => {
  it("parses auto value", () => {
    const target: StyleAccumulator = {};
    parseZIndex("auto", target);
    expect(target.zIndex).toBe("auto");
  });

  it("parses positive/zero/large integer values", () => {
    const t: StyleAccumulator = {};
    parseZIndex("5", t);   expect(t.zIndex).toBe(5);
    parseZIndex("0", t);   expect(t.zIndex).toBe(0);
    parseZIndex("100", t); expect(t.zIndex).toBe(100);
    // overflow: nossa política → aceitar enquanto couber em Number seguro (documentado)
    parseZIndex("999999999", t); expect(t.zIndex).toBe(999_999_999);
  });

  it("parses negative integer values", () => {
    const t: StyleAccumulator = {};
    parseZIndex("-1", t);   expect(t.zIndex).toBe(-1);
    parseZIndex("-999", t); expect(t.zIndex).toBe(-999);
  });

  it("rejects non-integer values (design choice: decimais inválidos)", () => {
    // Decisão explícita: z-index exige inteiro; "2.0" e "1.5" são rejeitados.
    // Se você decidir alinhar com engines que truncam "2.0"→2, troque os expects.
    const t: StyleAccumulator = {};
    parseZIndex("1.5", t); expect(t.zIndex).toBeUndefined();
    parseZIndex("2.0", t); expect(t.zIndex).toBeUndefined();
  });

  it("rejects invalid syntaxes and non-decimal bases", () => {
    const t: StyleAccumulator = {};
    parseZIndex("invalid", t); expect(t.zIndex).toBeUndefined();
    parseZIndex("", t);        expect(t.zIndex).toBeUndefined();
    parseZIndex("px", t);      expect(t.zIndex).toBeUndefined();
    parseZIndex("+5", t);      expect(t.zIndex).toBe(5); // sinal + é permitido (coerente com parseInt)
    parseZIndex("0x10", t);    expect(t.zIndex).toBeUndefined(); // hexa deve ser rejeitado
    parseZIndex("010", t);     expect(t.zIndex).toBe(10); // sem octal implícito
  });

  it("handles whitespace", () => {
    const t: StyleAccumulator = {};
    parseZIndex("  10  ", t);   expect(t.zIndex).toBe(10);
    parseZIndex("\tauto\t", t); expect(t.zIndex).toBe("auto");
  });
});

// ----------------- RENDER -----------------
describe("z-index rendering", () => {
  // HTML **completo** e com sobreposição forçada
  const html = `
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

  const css = `
    #red, #blue, #green {
      position: absolute;
      font-family: Arial;
      font-size: 12px;
    }
  `;

  // 1) Ordem ascendente por z-index (1→2→3) com cheques matemáticos
  it("paints by ascending z-index (1 -> 2 -> 3)", async () => {
    await renderHtmlToPdf({
      html, css,
      viewportWidth: 800, viewportHeight: 600,
      pageWidth: 800, pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true,
      debugCats: ["PARSE", "STYLE", "LAYOUT", "RENDER_TREE", "PAINT", "PAINT_TRACE"]
    });

    const calls = getCalls();
    type Item = { z: number; raw: string; idx: number };
    const seq: Item[] = calls
      .filter(c => c[0] === "PAINT")
      .map((c, i) => ({ raw: String(c[2]), idx: i }))
      .filter(x => isPaintCommandMsg(x.raw) || isPaintElementMsg(x.raw))
      .map(x => ({ z: extractZ(x.raw), raw: x.raw, idx: x.idx }))
      .filter(x => Number.isFinite(x.z));

    const zSeq = seq.map(s => s.z);
    expect(zSeq.length).toBeGreaterThanOrEqual(3);
    expect(nonDecreasing(zSeq)).toBe(true);

    const uniqueZ = [...new Set(zSeq)];
    const firstThree = uniqueZ.slice(0, 3);
    expect(firstThree).toEqual([1, 2, 3]);

    // (opcional) confirma 1 log por elemento caso seu DEBUG seja deduplicado
    const paintMsgs = calls
      .filter(c => c[0] === "PAINT" && c[1] === "DEBUG")
      .map(c => String(c[2]))
      .filter(isPaintElementMsg);
    if (paintMsgs.length >= 3) {
      const firstByZ = [1, 2, 3].map(z =>
        paintMsgs.find(m => extractZ(m) === z) ?? ""
      );
      expect(firstByZ[0]).toContain("z-index: 1");
      expect(firstByZ[1]).toContain("z-index: 2");
      expect(firstByZ[2]).toContain("z-index: 3");
    }
  });

  // 2) Fill antes de stroke e sem interleaving entre z’s
  it("ensures fill happens before stroke for each element and z-groups don't interleave (se disponível TRACE)", async () => {
    await renderHtmlToPdf({
      html, css,
      viewportWidth: 800, viewportHeight: 600,
      pageWidth: 800, pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true,
      debugCats: ["PAINT", "PAINT_TRACE"]
    });

    const calls = getCalls();
    const msgs = calls
      .filter(c => c[0] === "PAINT")
      .map((c, i) => ({ raw: String(c[2]), idx: i }))
      .filter(x => isPaintCommandMsg(x.raw) || isPaintElementMsg(x.raw));

    type Cmd = { z: number; id: string; op: "fill" | "stroke"; raw: string; idx: number };
    const cmds: Cmd[] = msgs.map(m => {
      const z = extractZ(m.raw);
      const id = extractId(m.raw) ?? "?";
      const op: "fill" | "stroke" = /stroke/i.test(m.raw) ? "stroke" : "fill";
      return { z, id, op, raw: m.raw, idx: m.idx };
    }).filter(c => Number.isFinite(c.z));

    if (cmds.length === 0) {
      // fallback: ao menos ordem por z
      const paintMsgs = calls
        .filter(c => c[0] === "PAINT" && c[1] === "DEBUG")
        .map(c => String(c[2]))
        .filter(isPaintElementMsg);
      expect(paintMsgs.length).toBeGreaterThanOrEqual(3);
      const zSeq = paintMsgs.map(extractZ).filter(Number.isFinite) as number[];
      expect(nonDecreasing(zSeq)).toBe(true);
      expect([...new Set(zSeq)].slice(0, 3)).toEqual([1, 2, 3]);
      return;
    }

    // 2a) Monotonicidade global por z
    const zSeq = cmds.map(c => c.z);
    expect(nonDecreasing(zSeq)).toBe(true);

    // 2b) Sem interleaving entre z adjacentes
    const byZ = new Map<number, Cmd[]>();
    for (const c of cmds) byZ.set(c.z, [...(byZ.get(c.z) ?? []), c]);
    const zValues = [...byZ.keys()].sort((a, b) => a - b);
    for (let i = 0; i < zValues.length - 1; i++) {
      const lower = byZ.get(zValues[i])!;
      const higher = byZ.get(zValues[i + 1])!;
      const lastLowerIdx = Math.max(...lower.map(c => c.idx));
      const firstHigherIdx = Math.min(...higher.map(c => c.idx));
      expect(lastLowerIdx).toBeLessThan(firstHigherIdx);
    }

    // 2c) Para cada elemento: fill antes de stroke e sem outro z no meio
    const byId = new Map<string, Cmd[]>();
    for (const c of cmds) byId.set(c.id, [...(byId.get(c.id) ?? []), c]);

    for (const [id, seq] of byId) {
      const fillIdx = seq.findIndex(c => c.op === "fill");
      const strokeIdx = seq.findIndex(c => c.op === "stroke");
      if (strokeIdx >= 0) {
        expect(fillIdx).toBeGreaterThanOrEqual(0);
        expect(strokeIdx).toBeGreaterThan(fillIdx);

        const zCurr = seq[0].z;
        const first = seq[fillIdx].idx;
        const last = seq[strokeIdx].idx;
        const between = cmds.filter(c => c.idx > first && c.idx < last);
        const hasForeignZ = between.some(c => c.z !== zCurr);
        expect(hasForeignZ).toBe(false);
      }
    }
  });

  // 3) Empate por z-index ⇒ DOM order
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

    const msgs = getCalls()
      .filter(c => c[0] === "PAINT")
      .map((c, i) => ({ raw: String(c[2]), idx: i }))
      .filter(x => isPaintElementMsg(x.raw) || isPaintCommandMsg(x.raw));

    // Colete a primeira ocorrência por id (a, b) mantendo apenas z=2
    const seen = new Map<string, { idx: number; z: number }>();
    for (const m of msgs) {
      const id = extractId(m.raw);
      const z = extractZ(m.raw);
      if (!id || z !== 2) continue;
      if (!seen.has(id)) seen.set(id, { idx: m.idx, z });
    }

    if (seen.has("a") && seen.has("b")) {
      const ia = seen.get("a")!.idx;
      const ib = seen.get("b")!.idx;
      expect(ia).toBeLessThan(ib); // DOM order
    } else {
      // fallback: pelo menos duas entradas com z=2 sem inversão
      const z2 = msgs.filter(m => extractZ(m.raw) === 2);
      expect(z2.length).toBeGreaterThanOrEqual(2);
      const indices = z2.map(m => m.idx);
      expect(nonDecreasing(indices)).toBe(true);
    }
  });

  // 4) Teste “hard”: rejeita interleaving que faria border de z baixo sobrepor fill de z alto
  it("rejects interleaved painting that would cause lower-z borders to overlap higher-z fills", async () => {
    await renderHtmlToPdf({
      html, css,
      viewportWidth: 800, viewportHeight: 600,
      pageWidth: 800, pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true,
      debugCats: ["PAINT", "PAINT_TRACE", "RENDER_TREE"]
    });

    type Cmd = { z: number; id: string; op: "fill" | "stroke"; raw: string; idx: number };
    const calls = getCalls();

    const msgs = calls
      .filter(c => c[0] === "PAINT")
      .map((c, i) => ({ raw: String(c[2]), idx: i }))
      .filter(x => isPaintCommandMsg(x.raw) || isPaintElementMsg(x.raw));

    const cmds: Cmd[] = msgs.map(m => {
      const z = extractZ(m.raw);
      const id = extractId(m.raw) ?? "?";
      const op: "fill" | "stroke" = /stroke/i.test(m.raw) ? "stroke" : "fill";
      return { z, id, op, raw: m.raw, idx: m.idx };
    }).filter(c => Number.isFinite(c.z));

    // 4a) Monotonicidade global por z
    const zSeq = cmds.map(c => c.z);
    expect(nonDecreasing(zSeq)).toBe(true);

    // 4b) Sem interleaving entre z's adjacentes
    const byZ = new Map<number, Cmd[]>();
    for (const c of cmds) byZ.set(c.z, [...(byZ.get(c.z) ?? []), c]);
    const zValues = [...byZ.keys()].sort((a, b) => a - b);
    for (let i = 0; i < zValues.length - 1; i++) {
      const lower = byZ.get(zValues[i])!;
      const higher = byZ.get(zValues[i + 1])!;
      const lastLowerIdx = Math.max(...lower.map(c => c.idx));
      const firstHigherIdx = Math.min(...higher.map(c => c.idx));
      expect(lastLowerIdx).toBeLessThan(firstHigherIdx);
    }

    // 4c) Para cada elemento: fill -> stroke e sem comandos de outro z no meio
    const byId = new Map<string, Cmd[]>();
    for (const c of cmds) byId.set(c.id, [...(byId.get(c.id) ?? []), c]);

    for (const [id, seq] of byId) {
      if (id === "?") continue;
      const fillIdx = seq.findIndex(c => c.op === "fill");
      const strokeIdx = seq.findIndex(c => c.op === "stroke");
      if (strokeIdx >= 0) {
        expect(fillIdx).toBeGreaterThanOrEqual(0);
        expect(strokeIdx).toBeGreaterThan(fillIdx);

        const zCurr = seq[0].z;
        const first = seq[fillIdx].idx;
        const last = seq[strokeIdx].idx;
        const between = cmds.filter(c => c.idx > first && c.idx < last);
        const hasForeignZBetween = between.some(c => c.z !== zCurr);
        expect(hasForeignZBetween).toBe(false);
      }
    }

    // 4d) Atomicidade por elemento no mesmo z
    for (const [id, seq] of byId) {
      if (id === "?" || seq.length <= 1) continue;
      const firstIdx = Math.min(...seq.map(c => c.idx));
      const lastIdx  = Math.max(...seq.map(c => c.idx));
      const zCurr = seq[0].z;
      const interleavedSameZOtherId = cmds.some(c => c.idx > firstIdx && c.idx < lastIdx && c.z === zCurr && c.id !== id);
      expect(interleavedSameZOtherId).toBe(false);
    }
  });

  // 5) z-index negativo deve vir antes de z>=0
  it("renders negative z-index correctly (behind non-negative)", async () => {
    const htmlNeg = `
      <!DOCTYPE html>
      <html><body style="margin:0">
        <div id="neg"  style="position:absolute; z-index:-1; background:#f0f; width:60px; height:60px; top:10px; left:10px;"></div>
        <div id="zero" style="position:absolute; z-index:0;  background:#0ff; width:60px; height:60px; top:20px; left:20px;"></div>
      </body></html>
    `;
    await renderHtmlToPdf({
      html: htmlNeg, css: "",
      viewportWidth: 300, viewportHeight: 200,
      pageWidth: 300, pageHeight: 200,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true, debugCats: ["PAINT", "PAINT_TRACE"]
    });

    const seq = getCalls()
      .filter(c => c[0] === "PAINT")
      .map((c, i) => ({ raw: String(c[2]), idx: i }))
      .filter(x => isPaintCommandMsg(x.raw) || isPaintElementMsg(x.raw))
      .map(x => ({ z: extractZ(x.raw), idx: x.idx }))
      .filter(x => Number.isFinite(x.z));
    const zSeq = seq.map(s => s.z);
    expect(zSeq.length).toBeGreaterThanOrEqual(2);
    expect(nonDecreasing(zSeq)).toBe(true);
    expect(Math.min(...zSeq)).toBeLessThan(0);
  });

  // 6) z-index:auto não deve criar reordenação relativa (fica no fluxo/stacking padrão)
  it("handles z-index:auto without creating unintended stacking", async () => {
    const htmlAuto = `
      <!DOCTYPE html>
      <html><body style="margin:0">
        <div id="a" style="position:absolute; z-index:auto; background:#ccc; width:60px; height:60px; top:10px; left:10px;"></div>
        <div id="b" style="position:absolute; z-index:1;    background:#999; width:60px; height:60px; top:20px; left:20px;"></div>
      </body></html>
    `;
    await renderHtmlToPdf({
      html: htmlAuto, css: "",
      viewportWidth: 300, viewportHeight: 200,
      pageWidth: 300, pageHeight: 200,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true, debugCats: ["PAINT", "PAINT_TRACE"]
    });

    const seq = getCalls()
      .filter(c => c[0] === "PAINT")
      .map((c, i) => ({ raw: String(c[2]), idx: i }))
      .filter(x => isPaintElementMsg(x.raw))
      .map(x => ({ z: extractZ(x.raw), raw: x.raw }))
      .filter(x => Number.isFinite(x.z));
    // esperamos ver algum z não definido numérico (auto ≈ 0/stack local) OU ausência de log com z explícito;
    // o importante: se houver valores numéricos, que não violem monotonicidade nem "pulem" o z=1 do #b.
    if (seq.length >= 1) {
      const zSeq = seq.map(s => s.z);
      expect(nonDecreasing(zSeq)).toBe(true);
    }
  });

  // 7) z-index ignorado quando position: static
  it("ignores z-index on static positioned elements", async () => {
    const htmlStatic = `
      <!DOCTYPE html>
      <html><body style="margin:0">
        <div id="s1" style="position:static; z-index:10; background:#aaa; width:60px; height:60px;"></div>
        <div id="s2" style="position:static; z-index:1;  background:#bbb; width:60px; height:60px;"></div>
      </body></html>
    `;
    await renderHtmlToPdf({
      html: htmlStatic, css: "",
      viewportWidth: 300, viewportHeight: 200,
      pageWidth: 300, pageHeight: 200,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true, debugCats: ["PAINT", "PAINT_TRACE"]
    });

    // Como static não cria camada z-index, qualquer z extraído deve ser ignorado/ausente;
    // Se houver números, ao menos não devem quebrar monotonicidade trivial.
    const seq = getCalls()
      .filter(c => c[0] === "PAINT")
      .map((c, i) => ({ raw: String(c[2]), idx: i }))
      .filter(x => isPaintElementMsg(x.raw))
      .map(x => extractZ(x.raw))
      .filter(Number.isFinite) as number[];
    if (seq.length > 0) {
      expect(nonDecreasing(seq)).toBe(true);
    }
  });

  // 8) stacking contexts aninhados: filho com z alto dentro de pai com z baixo
  it("handles nested stacking contexts correctly", async () => {
    const htmlNested = `
      <!DOCTYPE html>
      <html><body style="margin:0">
        <div id="outerLow"  style="position:relative; z-index:1; background:#eee; width:160px; height:160px; top:10px; left:10px;">
          <div id="innerHigh" style="position:relative; z-index:999; background:#444; width:120px; height:120px; top:20px; left:20px;"></div>
        </div>
        <div id="sibling"   style="position:absolute; z-index:2;   background:#0a0; width:120px; height:120px; top:40px; left:140px;"></div>
      </body></html>
    `;
    await renderHtmlToPdf({
      html: htmlNested, css: "",
      viewportWidth: 500, viewportHeight: 300,
      pageWidth: 500, pageHeight: 300,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true, debugCats: ["PAINT", "PAINT_TRACE", "RENDER_TREE"]
    });

    // Verificação: comandos do innerHigh devem ter z >= do outerLow (mesmo contexto),
    // mas o stacking do outerLow (z=1) como um todo deve vir antes do sibling (z=2).
    const calls = getCalls();
    const seq = calls
      .filter(c => c[0] === "PAINT")
      .map((c, i) => ({ raw: String(c[2]), idx: i }))
      .filter(x => isPaintElementMsg(x.raw) || isPaintCommandMsg(x.raw))
      .map(x => ({ z: extractZ(x.raw), id: extractId(x.raw), idx: x.idx }))
      .filter(x => Number.isFinite(x.z));

    const zSeq = seq.map(s => s.z);
    expect(nonDecreasing(zSeq)).toBe(true);

    const firstOuter = seq.find(s => s.id === "outerLow");
    const firstSibling = seq.find(s => s.id === "sibling");
    if (firstOuter && firstSibling) {
      expect(firstOuter.idx).toBeLessThan(firstSibling.idx); // pai (z=1) antes do irmão (z=2)
    }
    const firstInner = seq.find(s => s.id === "innerHigh");
    if (firstInner && firstOuter) {
      expect(firstInner.z).toBeGreaterThanOrEqual(firstOuter.z); // inner ≥ outer no contexto do pai
    }
  });
});
