// tests/z-index-simple.spec.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHtmlToPdf } from "../src/html-to-pdf.js";


// Store original console.log to capture debug output
let capturedLogs: any[] = [];

beforeEach(() => {
  capturedLogs = [];
  // Capture console.log calls to get debug output
  vi.spyOn(console, 'log').mockImplementation((...args) => {
    capturedLogs.push(args);
  });
});

describe("z-index painting order", () => {
  it("paints divs in correct z-index order (1 -> 2 -> 3)", async () => {
    const html = `
      <html>
        <body>
          <div id="red" style="position:absolute; z-index:1; background:red; width:100px; height:100px;"></div>
          <div id="blue" style="position:absolute; z-index:2; background:blue; width:100px; height:100px;"></div>
          <div id="green" style="position:absolute; z-index:3; background:green; width:100px; height:100px;"></div>
        </body>
      </html>
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

    // Debug: print captured logs to see what's being captured
    console.log("Captured logs:", capturedLogs);
    
    // Captura todas as mensagens de pintura dos logs capturados
    const paintMessages = capturedLogs
      .filter((args: any[]) => args[0] === "[PAINT] DEBUG")
      .map((args: any[]) => String(args[1]));

    console.log("Paint messages:", paintMessages);

    // Filtra mensagens que contêm informações de z-index
    const zIndexOrder = paintMessages
      .map((msg: string) => {
        if (msg.includes("z:1") || msg.includes("#red")) return 1;
        if (msg.includes("z:2") || msg.includes("#blue")) return 2;
        if (msg.includes("z:3") || msg.includes("#green")) return 3;
        return null;
      })
      .filter((z: number | null) => z !== null);

    console.log("Z-index order:", zIndexOrder);

    // Verifica se temos pelo menos 3 elementos pintados
    expect(zIndexOrder.length).toBeGreaterThanOrEqual(3);

    // Verifica se a ordem é não-decrescente (1, 2, 3)
    for (let i = 1; i < zIndexOrder.length; i++) {
      expect(zIndexOrder[i]!).toBeGreaterThanOrEqual(zIndexOrder[i - 1]!);
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
