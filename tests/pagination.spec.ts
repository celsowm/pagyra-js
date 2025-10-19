import { describe, expect, it } from "vitest";
import { paginateTree } from "../src/pdf/pagination.js";
import {
  NodeKind,
  Overflow,
  type RenderBox,
  type Rect,
  type Edges,
  type Radius,
  type Background,
  type Run,
} from "../src/pdf/types.js";

const ZERO_EDGES: Edges = { top: 0, right: 0, bottom: 0, left: 0 };
const ZERO_RADIUS: Radius = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 0, y: 0 },
  bottomRight: { x: 0, y: 0 },
  bottomLeft: { x: 0, y: 0 },
};
const TRANSPARENT_BG: Background = {};

function makeRect(y: number, height: number, width = 100, x = 0): Rect {
  return { x, y, width, height };
}

function createBox(
  id: string,
  kind: NodeKind,
  y: number,
  height: number,
  extra: Partial<RenderBox> = {},
): RenderBox {
  const content = makeRect(y, height);
  return {
    id,
    kind,
    contentBox: content,
    paddingBox: { ...content },
    borderBox: { ...content },
    visualOverflow: { ...content },
    padding: { ...ZERO_EDGES },
    border: { ...ZERO_EDGES },
    borderRadius: { ...ZERO_RADIUS },
    background: { ...TRANSPARENT_BG },
    opacity: 1,
    overflow: Overflow.Visible,
    textRuns: [],
    decorations: {},
    textShadows: [],
    image: undefined,
    objectFit: undefined,
    marker: undefined,
    markerRect: undefined,
    tableModel: undefined,
    tableCaption: null,
    colgroups: [],
    cols: [],
    multicol: undefined,
    boxShadows: [],
    establishesStackingContext: false,
    zIndexComputed: 0,
    positioning: { type: "normal" },
    containingBlockForAbs: null,
    children: [],
    links: [],
    customData: {},
    borderColor: undefined,
    color: undefined,
    ...extra,
  };
}

function createRun(text: string, fontSize: number, baseline: number): Run {
  return {
    text,
    fontFamily: "sans-serif",
    fontSize,
    fontWeight: undefined,
    fill: { r: 0, g: 0, b: 0, a: 1 },
    lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: baseline },
  };
}

describe("paginateTree", () => {
  it("splits boxes across multiple pages while tracking page offsets", () => {
    const root = createBox("root", NodeKind.Container, 0, 720);
    const first = createBox("first", NodeKind.Container, 20, 200);
    const spanning = createBox("spanning", NodeKind.Container, 380, 150);
    const secondOnly = createBox("second", NodeKind.Container, 620, 100);

    root.children = [first, spanning, secondOnly];

    const pages = paginateTree(root, { pageHeight: 400 });

    expect(pages).toHaveLength(2);
    expect(pages[0].pageOffsetY).toBe(0);
    expect(pages[1].pageOffsetY).toBe(400);

    expect(pages[0].paintOrder).toEqual(expect.arrayContaining([root, first, spanning]));
    expect(pages[0].paintOrder).not.toContain(secondOnly);

    expect(pages[1].paintOrder).toEqual(expect.arrayContaining([root, spanning, secondOnly]));
    expect(pages[1].paintOrder).not.toContain(first);
  });

  it("keeps text boxes on all pages that their baselines intersect", () => {
    const root = createBox("root", NodeKind.Container, 0, 0);
    const textBox = createBox("text", NodeKind.TextRuns, 0, 0, {
      textRuns: [
        createRun("line 1", 16, 20),
        createRun("line 2", 16, 420),
      ],
    });

    root.children = [textBox];

    const pages = paginateTree(root, { pageHeight: 400 });

    expect(pages).toHaveLength(2);
    expect(pages[0].flowContentOrder).toContain(textBox);
    expect(pages[1].flowContentOrder).toContain(textBox);
  });
});
