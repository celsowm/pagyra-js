import type { RenderBox } from "../../src/pdf/types.js";
import { buildStackingContexts } from "../../src/pdf/stacking/build-stacking-contexts.js";
import { resolvePaintOrder } from "../../src/pdf/stacking/resolve-paint-order.js";

interface BoxOptions {
  positioned?: boolean;
  zIndex?: number;
  establishesStackingContext?: boolean;
  opacity?: number;
}

function makeBox(id: string, options: BoxOptions = {}): RenderBox {
  return {
    id,
    children: [],
    positioning: { type: options.positioned ? "absolute" : "normal" },
    zIndexComputed: options.zIndex ?? 0,
    establishesStackingContext: options.establishesStackingContext ?? false,
    opacity: options.opacity ?? 1,
  } as unknown as RenderBox;
}

describe("stacking context index", () => {
  it("indexes context roots by RenderBox identity", () => {
    const root = makeBox("root");
    const normal = makeBox("normal");
    const nested = makeBox("nested", { positioned: true, zIndex: 2 });
    root.children.push(normal);
    normal.children.push(nested);

    const { rootContextId, contexts, contextByBox } = buildStackingContexts(root);

    expect(contextByBox.get(root)?.id).toBe(rootContextId);
    expect(contextByBox.get(normal)).toBeUndefined();
    expect(contextByBox.get(nested)?.parentId).toBe(rootContextId);
    expect(contexts.size).toBe(2);
  });

  it("preserves z-index paint ordering while using the index", () => {
    const root = makeBox("root");
    const positive = makeBox("positive", { positioned: true, zIndex: 2 });
    const normal = makeBox("normal");
    const negative = makeBox("negative", { positioned: true, zIndex: -1 });
    root.children.push(positive, normal, negative);

    const paintedIds = resolvePaintOrder(root)
      .filter((step) => step.type === "box")
      .map((step) => step.box.id);

    expect(paintedIds).toEqual(["root", "negative", "normal", "positive"]);
  });
});
