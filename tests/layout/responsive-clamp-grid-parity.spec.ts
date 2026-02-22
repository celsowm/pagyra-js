import { collectBoxes, renderTreeForHtml } from "../helpers/render-utils.js";
import type { RenderBox } from "../../src/pdf/types.js";

function firstByTag(boxes: RenderBox[], tagName: string): RenderBox {
  const found = boxes.find((box) => box.tagName === tagName);
  if (!found) {
    throw new Error(`Expected <${tagName}> in render tree`);
  }
  return found;
}

describe("responsive clamp grid parity", () => {
  it("matches browser-like grid stretch and wrapped flex growth for the repro", async () => {
    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Responsive Grid com clamp()</title>
  <style>
    body {
      margin: 0;
      display: grid;
      grid-template-columns: clamp(150px, 20vw, 300px) 1fr;
      height: 100vh;
      font-family: sans-serif;
    }
    aside {
      background: #333;
      color: white;
      padding: 20px;
    }
    main {
      display: flex;
      flex-wrap: wrap;
      gap: clamp(10px, 5vw, 40px);
      padding: calc(10px + 2%);
    }
    div {
      flex: 1 1 200px;
      height: 150px;
      background: #6c5ce7;
      border-radius: 8px;
      font-size: clamp(1rem, 3vw, 2rem);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
  </style>
</head>
<body>
  <aside>Menu</aside>
  <main>
    <div>Card 1</div>
    <div>Card 2</div>
    <div>Card 3</div>
  </main>
</body>
</html>`;

    const tree = await renderTreeForHtml(html);
    const boxes = collectBoxes(tree.root);
    const body = firstByTag(boxes, "body");
    const aside = firstByTag(boxes, "aside");
    const main = firstByTag(boxes, "main");
    const cards = boxes
      .filter((box) => box.tagName === "div")
      .sort((a, b) => (a.contentBox.y - b.contentBox.y) || (a.contentBox.x - b.contentBox.x));

    expect(cards).toHaveLength(3);

    // 1123 viewport height minus 48 top/bottom default page margins in test helper.
    expect(body.contentBox.height).toBeCloseTo(1123 - 48 - 48, 1);

    expect(aside.borderBox.height).toBeCloseTo(main.borderBox.height, 1);
    expect(main.borderBox.height).toBeGreaterThan(900);

    expect(cards[0].contentBox.width).toBeCloseTo(cards[1].contentBox.width, 1);
    expect(cards[0].contentBox.width).toBeGreaterThan(220);
    expect(cards[2].contentBox.width).toBeGreaterThan(main.contentBox.width - 2);
    expect(cards[2].contentBox.y).toBeGreaterThan(cards[0].contentBox.y + 400);
  });
});
