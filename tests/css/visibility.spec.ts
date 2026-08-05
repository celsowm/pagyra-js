import type { LayoutNode } from "../../src/dom/node.js";
import type { PagePainter } from "../../src/pdf/page-painter.js";
import type { RenderBox } from "../../src/pdf/types.js";
import { paintBoxAtomic } from "../../src/pdf/renderer/box-painter.js";
import { prepareHtmlRender } from "../../src/html-to-pdf/prepare-html-render.js";

function findLayoutNodeById(root: LayoutNode, id: string): LayoutNode {
  let found: LayoutNode | undefined;
  root.walk((node) => {
    if (node.customData?.id === id) {
      found = node;
    }
  });
  if (!found) {
    throw new Error(`Missing layout node ${id}`);
  }
  return found;
}

function findRenderBoxById(root: RenderBox, id: string): RenderBox {
  if (root.customData?.id === id) {
    return root;
  }
  for (const child of root.children) {
    try {
      return findRenderBoxById(child, id);
    } catch {
      // Continue searching sibling subtrees.
    }
  }
  throw new Error(`Missing render box ${id}`);
}

describe("visibility", () => {
  it("inherits hidden while allowing a descendant to become visible", async () => {
    const prepared = await prepareHtmlRender({
      html: `
        <div id="hidden">
          <span id="inherited">Inherited hidden</span>
          <span id="restored">Restored visible</span>
        </div>
        <div id="following">Following</div>
      `,
      css: `
        @page { size: 300px 300px; margin: 0; }
        html, body, div, span { margin: 0; padding: 0; }
        #hidden { visibility: hidden; height: 40px; }
        #restored { visibility: visible; }
        #following { height: 20px; }
      `,
      pagedBodyMargin: "zero",
    });

    const hidden = findLayoutNodeById(prepared.layoutRoot, "hidden");
    const inherited = findLayoutNodeById(prepared.layoutRoot, "inherited");
    const restored = findLayoutNodeById(prepared.layoutRoot, "restored");
    const following = findLayoutNodeById(prepared.layoutRoot, "following");

    expect(hidden.style.visibility).toBe("hidden");
    expect(inherited.style.visibility).toBe("hidden");
    expect(restored.style.visibility).toBe("visible");
    expect(restored.children.every((child) => child.style.visibility === "visible")).toBe(true);
    expect(following.box.y).toBeGreaterThanOrEqual(hidden.box.y + 40);

    expect(findRenderBoxById(prepared.renderTree.root, "hidden").visibility).toBe("hidden");
    expect(findRenderBoxById(prepared.renderTree.root, "inherited").visibility).toBe("hidden");
    expect(findRenderBoxById(prepared.renderTree.root, "restored").visibility).toBe("visible");
  });

  it("ignores invalid values and accepts collapse", async () => {
    const prepared = await prepareHtmlRender({
      html: `<div id="invalid">Invalid</div><div id="collapsed">Collapsed</div>`,
      css: `#invalid { visibility: transparent; } #collapsed { visibility: collapse; }`,
      pagedBodyMargin: "zero",
    });

    expect(findLayoutNodeById(prepared.layoutRoot, "invalid").style.visibility).toBe("visible");
    expect(findLayoutNodeById(prepared.layoutRoot, "collapsed").style.visibility).toBe("collapse");
  });

  it("returns before touching the painter for hidden and collapsed boxes", async () => {
    const prepared = await prepareHtmlRender({
      html: `<div id="hidden">Hidden</div><div id="collapsed">Collapsed</div>`,
      css: `#hidden { visibility: hidden; } #collapsed { visibility: collapse; }`,
      pagedBodyMargin: "zero",
    });

    let accessed = false;
    const painter = new Proxy({}, {
      get() {
        accessed = true;
        throw new Error("Painter should not be touched");
      },
    }) as PagePainter;

    await paintBoxAtomic(painter, findRenderBoxById(prepared.renderTree.root, "hidden"));
    await paintBoxAtomic(painter, findRenderBoxById(prepared.renderTree.root, "collapsed"));
    expect(accessed).toBe(false);
  });
});
