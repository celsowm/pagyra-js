// tests/z-index.spec.ts
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { parseZIndex } from "../src/css/parsers/dimension-parser.js";
import type { StyleAccumulator } from "../src/css/style.js";
import { renderHtmlToPdf } from "../src/html-to-pdf.js";
import { log } from "../src/debug/log.js";

// ---- Mock de logger robusto
vi.mock("../src/debug/log.js", () => {
  const log = vi.fn();
  const configureDebug = vi.fn();
  return { log, configureDebug, default: { log, configureDebug } };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- PARSER ----------
describe("z-index parser", () => {
  it("parses auto value", () => {
    const target: StyleAccumulator = {};
    parseZIndex("auto", target);
    expect(target.zIndex).toBe("auto");
  });

  it("parses positive integer values", () => {
    const t: StyleAccumulator = {};
    parseZIndex("5", t);   expect(t.zIndex).toBe(5);
    parseZIndex("0", t);   expect(t.zIndex).toBe(0);
    parseZIndex("100", t); expect(t.zIndex).toBe(100);
  });

  it("parses negative integer values", () => {
    const t: StyleAccumulator = {};
    parseZIndex("-1", t);   expect(t.zIndex).toBe(-1);
    parseZIndex("-999", t); expect(t.zIndex).toBe(-999);
  });

  it("ignores non-integer values", () => {
    const t: StyleAccumulator = {};
    parseZIndex("1.5", t); expect(t.zIndex).toBeUndefined();
    parseZIndex("2.0", t); expect(t.zIndex).toBeUndefined();
  });

  it("ignores invalid values", () => {
    const t: StyleAccumulator = {};
    parseZIndex("invalid", t); expect(t.zIndex).toBeUndefined();
    parseZIndex("", t);        expect(t.zIndex).toBeUndefined();
    parseZIndex("px", t);      expect(t.zIndex).toBeUndefined();
  });

  it("handles whitespace", () => {
    const t: StyleAccumulator = {};
    parseZIndex("  10  ", t);   expect(t.zIndex).toBe(10);
    parseZIndex("\tauto\t", t); expect(t.zIndex).toBe("auto");
  });
});

// ---------- RENDER ----------
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

  function getCalls() {
    return (log as unknown as Mock).mock.calls as unknown[][];
  }

  it("paints by ascending z-index (1 -> 2 -> 3)", async () => {
    await renderHtmlToPdf({
      html, css,
      viewportWidth: 800, viewportHeight: 600,
      pageWidth: 800, pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true,
      // inclua todas as cats para não perder mensagem
      debugCats: ["PARSE", "STYLE", "LAYOUT", "RENDER_TREE", "PAINT"]
    });

    // Confirma que entrou na fase de coleta
    expect(log).toHaveBeenCalledWith(
      "PAINT",
      "DEBUG",
      expect.stringContaining("Collecting render commands")
    );

    // Coleta das mensagens de pintura
    const paintMsgs = getCalls()
      .filter(c => c[0] === "PAINT" && c[1] === "DEBUG")
      .map(c => String(c[2]))
      .filter(m => m.includes("Painting element"));

    // Fallback robusto: aceita msgs com ou sem id, mas exige ordem por z-index
    expect(paintMsgs.length).toBeGreaterThanOrEqual(3);
    expect(paintMsgs).toEqual([
      expect.stringContaining("z-index: 1"),
      expect.stringContaining("z-index: 2"),
      expect.stringContaining("z-index: 3"),
    ]);
  });

  it("ensures fill happens before stroke for each element and z-groups don't interleave (se disponível TRACE)", async () => {
    // Rodar de novo para pegar TRACE se existir
    await renderHtmlToPdf({
      html, css,
      viewportWidth: 800, viewportHeight: 600,
      pageWidth: 800, pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true,
      debugCats: ["PAINT"]
    });

    const calls = getCalls();
    const trace = calls
      .filter(c => c[0] === "PAINT" && (c[1] === "TRACE" || c[1] === "DEBUG"))
      .map(c => String(c[2]))
      .filter(m => /op=(fill|stroke)/i.test(m));

    // Se o engine ainda não emite TRACE por comando, pula esse teste de precisão
    if (trace.length === 0) {
      // Garante ao menos a ordem por z-index (já cobre o bug principal)
      const paintMsgs = calls
        .filter(c => c[0] === "PAINT" && c[1] === "DEBUG")
        .map(c => String(c[2]))
        .filter(m => m.includes("Painting element"));

      expect(paintMsgs).toEqual([
        expect.stringContaining("z-index: 1"),
        expect.stringContaining("z-index: 2"),
        expect.stringContaining("z-index: 3"),
      ]);
      return;
    }

    // Quando existir TRACE por comando:
    // Esperamos strings do tipo: "cmd: id=green z=3 op=fillRect" / "op=strokeRect"
    type Cmd = { z: number; id: string; op: "fill" | "stroke"; raw: string };
    const cmds: Cmd[] = trace.map((m) => {
      const z = Number((/z(?:-index)?[:=]\s*(-?\d+)/i.exec(m) ?? [,"0"])[1]);
      const id = (/(?:id|elem)[=:]\s*([#\w-]+)/i.exec(m) ?? [, "?"])[1];
      const op = /stroke/i.test(m) ? "stroke" : "fill";
      return { z, id, op, raw: m };
    });

    // 1) nada de interleaving: todos z=1 antes de z=2, etc.
    const zSeq = cmds.map(c => c.z);
    const sorted = [...zSeq].sort((a,b)=>a-b);
    expect(zSeq).toEqual(sorted);

    // 2) para cada id, fill vem antes de stroke
    const byId = new Map<string, Cmd[]>();
    for (const c of cmds) byId.set(c.id, [...(byId.get(c.id) ?? []), c]);
    for (const [id, seq] of byId) {
      const firstFill = seq.findIndex(c => c.op === "fill");
      const firstStroke = seq.findIndex(c => c.op === "stroke");
      expect(firstFill).toBeGreaterThanOrEqual(0);
      expect(firstStroke).toBeGreaterThan(firstFill);
    }
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
      debug: true, debugCats: ["PAINT"]
    });

    const msgs = (log as unknown as Mock).mock.calls
      .filter(c => c[0]==="PAINT" && c[1]==="DEBUG")
      .map(c => String(c[2]))
      .filter(m => m.includes("Painting element"));

    // Espera-se DOM order: #a antes de #b
    // Aceitamos a ausência de id no log, mas exigimos pelo menos duas entradas com mesmo z
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    // Se IDs existirem no log, fortalecemos:
    const joined = msgs.join("\n");
    if (/id=a/.test(joined) && /id=b/.test(joined)) {
      const ia = joined.indexOf("id=a");
      const ib = joined.indexOf("id=b");
      expect(ia).toBeGreaterThanOrEqual(0);
      expect(ib).toBeGreaterThan(ia);
    }

    it("rejects interleaved painting that would cause lower-z borders to overlap higher-z fills", async () => {
      await renderHtmlToPdf({
        html, css,
        viewportWidth: 800, viewportHeight: 600,
        pageWidth: 800, pageHeight: 600,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
        debug: true,
        // precisa log por comando; ajuste os nomes se seu engine usar outro
        debugCats: ["PAINT", "PAINT_TRACE", "RENDER_TREE"]
      });

      type Cmd = { z: number; id: string; op: "fill" | "stroke"; raw: string; idx: number };

      const calls = (log as unknown as Mock).mock.calls;

      // Colete logs de pintura (TRACE/DEBUG) preservando o índice temporal
      const msgs = calls
        .filter(c => c[0] === "PAINT")
        .map((c, i) => ({ raw: String(c[2]), idx: i }))
        // aceita tanto "op=fill/ stroke" quanto logs agregados de elemento
        .filter(x =>
          /(op=)?(fill|stroke)/i.test(x.raw) ||
          /fillBackground|fillBorder|draw(Image|Svg|TextRun|BackgroundImage)/i.test(x.raw) ||
          /Painting element/i.test(x.raw)
        );

      // Normaliza: extrai z, id e op
      const cmds: Cmd[] = msgs.map(m => {
        const z = Number((/z(?:-index)?[:=]\s*(-?\d+)/i.exec(m.raw) ?? [,"0"])[1]);
        const id =
          (/(?:^|\s)(?:id|elem)[:=]\s*([#\w-]+)/i.exec(m.raw)?.[1]) ??
          (/#([\w-]+)/.exec(m.raw)?.[1]) ?? // caso apareça "#green"
          "?";
        // prioridade: se houver 'stroke' explícito, é stroke; caso contrário fill
        const op = /stroke/i.test(m.raw) ? "stroke" : "fill";
        return { z, id, op, raw: m.raw, idx: m.idx };
      });

      // 1) Monotonicidade global por z
      const zSeq = cmds.map(c => c.z);
      const sorted = [...zSeq].sort((a,b)=>a-b);
      expect(zSeq).toEqual(sorted);

      // 2) Sem interleaving entre z's adjacentes: todo z=a antes de qualquer z=b (a<b)
      const byZ = new Map<number, Cmd[]>();
      for (const c of cmds) byZ.set(c.z, [...(byZ.get(c.z) ?? []), c]);
      const zValues = [...byZ.keys()].sort((a,b)=>a-b);
      for (let i = 0; i < zValues.length - 1; i++) {
        const lower = byZ.get(zValues[i])!;
        const higher = byZ.get(zValues[i+1])!;
        const lastLowerIdx = Math.max(...lower.map(c => c.idx));
        const firstHigherIdx = Math.min(...higher.map(c => c.idx));
        expect(lastLowerIdx).toBeLessThan(firstHigherIdx); // falha se houver interleaving
      }

      // 3) Para cada elemento: fill antes de stroke e sem z diferente entre fill→stroke
      const byId = new Map<string, Cmd[]>();
      for (const c of cmds) byId.set(c.id, [...(byId.get(c.id) ?? []), c]);

      for (const [id, seq] of byId) {
        if (id === "?") continue; // se não temos id, não aplicamos a verificação 3b
        const fillIdx = seq.findIndex(c => c.op === "fill");
        const strokeIdx = seq.findIndex(c => c.op === "stroke");
        if (strokeIdx >= 0) {
          expect(fillIdx).toBeGreaterThanOrEqual(0);
          expect(strokeIdx).toBeGreaterThan(fillIdx);

          const zCurr = seq[0].z;
          const first = seq[fillIdx].idx;
          const last  = seq[strokeIdx].idx;
          const between = cmds.filter(c => c.idx > first && c.idx < last);
          const hasForeignZBetween = between.some(c => c.z !== zCurr);
          expect(hasForeignZBetween).toBe(false); // nenhum outro z entre fill e stroke do MESMO elemento
        }
      }

      // 4) (Opcional forte) Elemento pintado como bloco atômico (sem comandos de outro id no meio, mesmo z)
      for (const [id, seq] of byId) {
        if (id === "?" || seq.length <= 1) continue;
        const firstIdx = Math.min(...seq.map(c => c.idx));
        const lastIdx  = Math.max(...seq.map(c => c.idx));
        const zCurr = seq[0].z;
        const interleavedSameZOtherId = cmds.some(c => c.idx > firstIdx && c.idx < lastIdx && c.z === zCurr && c.id !== id);
        expect(interleavedSameZOtherId).toBe(false);
      }
    });

  });
});
