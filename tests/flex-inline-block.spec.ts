import { describe, it, expect } from "vitest";
import { LayoutNode } from "../src/dom/node.js";
import { ComputedStyle } from "../src/css/style.js";
import { Display, JustifyContent, AlignItems } from "../src/css/enums.js";
import { layoutTree } from "../src/layout/pipeline/layout-tree.js";

describe("flex layout inline-block sizing", () => {
  it("keeps inline-block flex items at the container width when stretched by flex", () => {
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      fontSize: 16,
      lineHeight: 19.2,
    });
    const textNode = new LayoutNode(textStyle, [], {
      textContent: "Conteúdo dentro da caixa com borda azul e gradiente.",
    });

    const spanStyle = new ComputedStyle({
      display: Display.InlineBlock,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 10,
      paddingBottom: 10,
    });
    const spanNode = new LayoutNode(spanStyle, [textNode], { tagName: "span" });

    const flexStyle = new ComputedStyle({
      display: Display.Flex,
      justifyContent: JustifyContent.Center,
      alignItems: AlignItems.Center,
      width: 300,
      height: 200,
      borderLeft: 5,
      borderRight: 5,
      borderTop: 5,
      borderBottom: 5,
    });
    const flexNode = new LayoutNode(flexStyle, [spanNode], { tagName: "div" });

    const rootStyle = new ComputedStyle({
      display: Display.Block,
      width: 600,
      height: 400,
    });
    const rootNode = new LayoutNode(rootStyle, [flexNode], { tagName: "body" });

    layoutTree(rootNode, { width: 600, height: 800 });

    expect(spanNode.box.borderBoxWidth).toBeCloseTo(300, 5e-1);
    expect(spanNode.box.contentWidth).toBeCloseTo(280, 5e-1);
    expect(spanNode.box.borderBoxWidth - spanNode.box.contentWidth).toBeCloseTo(20, 5e-1);
  });
});
