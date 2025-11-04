import type { RenderBox } from "../types.js";

type StackingContext = {
  boxes: RenderBox[];
  zIndex: number;
};

function getZIndex(box: RenderBox): number {
  return box.zIndexComputed ?? 0;
}

function createsStackingContext(box: RenderBox): boolean {
  return box.establishesStackingContext ?? false;
}

function processChildren(box: RenderBox): RenderBox[] {
  if (createsStackingContext(box)) {
    return sortBoxesByZIndex(box.children);
  }
  return box.children.flatMap(processChildren);
}

export function sortBoxesByZIndex(boxes: ReadonlyArray<RenderBox>): RenderBox[] {
  const rootContext: StackingContext = { boxes: [], zIndex: 0 };
  const stackingContexts = new Map<number, StackingContext>();

  // Partition nodes into stacking contexts
  for (const box of boxes) {
    if (createsStackingContext(box)) {
      const zIndex = getZIndex(box);
      if (!stackingContexts.has(zIndex)) {
        stackingContexts.set(zIndex, { boxes: [], zIndex });
      }
      stackingContexts.get(zIndex)!.boxes.push(box);
    } else {
      rootContext.boxes.push(box);
    }
  }

  // Sort stacking contexts by z-index
  const sortedContexts = Array.from(stackingContexts.values()).sort((a, b) => a.zIndex - b.zIndex);

  const result: RenderBox[] = [];

  // 1. Boxes with negative z-index
  for (const context of sortedContexts.filter((c) => c.zIndex < 0)) {
    for (const box of context.boxes) {
      result.push(box, ...processChildren(box));
    }
  }

  // 2. Boxes in the root stacking context
  for (const box of rootContext.boxes) {
    result.push(box, ...processChildren(box));
  }

  // 3. Boxes with z-index 0
  for (const context of sortedContexts.filter((c) => c.zIndex === 0)) {
    for (const box of context.boxes) {
      result.push(box, ...processChildren(box));
    }
  }

  // 4. Boxes with positive z-index
  for (const context of sortedContexts.filter((c) => c.zIndex > 0)) {
    for (const box of context.boxes) {
      result.push(box, ...processChildren(box));
    }
  }

  return result;
}
