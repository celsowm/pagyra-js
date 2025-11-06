// tests/z-index-simple.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHtmlToPdf } from "../src/html-to-pdf.js";
import { log } from "../src/debug/log.js";

// Mock do logger
vi.mock("../src/debug/log.js", () => ({
  log: vi.fn(),
  configureDebug: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("z-index painting order", () => {
  it("paints divs in correct z-index order (1 -> 2 -> 3)", async () => {
    const html = `
      <div id="red" style="position:absolute; z-index:1; background:red; width:100px; height:100px;"></div>
      <div id="blue" style="position:absolute; z-index:2; background:blue; width:100px; height:100px;"></div>
      <div id="green" style="position:absolute; z-index:3; background:green; width:100px; height:100px;"></div>
    `;

    await renderHtmlToPdf({
      html,
      css: "",
      viewportWidth: 800,
      viewportHeight: 600, 
      pageWidth: 800,
      pageHeight: 600,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      debug: true,
      debugCats: ["PAINT"]
    });

    // Captura todas as mensagens de pintura
    const calls = (log as any).mock.calls;
    const paintMessages = calls
      .filter((call: any[]) => call[0] === "PAINT")
      .map((call: any[]) => String(call[2]));

    // Filtra mensagens que contêm informações de z-index
    const zIndexOrder = paintMessages
      .map((msg: string) => {
        if (msg.includes("z-index:1") || msg.includes("z:1") || msg.includes("#red")) return 1;
        if (msg.includes("z-index:2") || msg.includes("z:2") || msg.includes("#blue")) return 2;
        if (msg.includes("z-index:3") || msg.includes("z:3") || msg.includes("#green")) return 3;
        return null;
      })
      .filter((z: number | null) => z !== null);

    // Verifica se temos pelo menos 3 elementos pintados
    expect(zIndexOrder.length).toBeGreaterThanOrEqual(3);

    // Verifica se a ordem é não-decrescente (1, 2, 3)
    for (let i = 1; i < zIndexOrder.length; i++) {
      expect(zIndexOrder[i]).toBeGreaterThanOrEqual(zIndexOrder[i - 1]);
    }

    // Verifica especificamente a presença e ordem dos valores 1, 2, 3
    const firstRed = zIndexOrder.indexOf(1);
    const firstBlue = zIndexOrder.indexOf(2); 
    const firstGreen = zIndexOrder.indexOf(3);

    expect(firstRed).toBeGreaterThanOrEqual(0);
    expect(firstBlue).toBeGreaterThan(firstRed);
    expect(firstGreen).toBeGreaterThan(firstBlue);
  });
});