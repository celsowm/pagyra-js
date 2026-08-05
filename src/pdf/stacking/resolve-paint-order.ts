import type { RenderBox } from "../types.js";
import { buildStackingContexts, getStackingFlags } from "./build-stacking-contexts.js";
import type { PaintInstruction, StackingContextId, StackingContextNode } from "./types.js";

export function resolvePaintOrder(root: RenderBox): PaintInstruction[] {
  const { rootContextId, contexts, contextByBox } = buildStackingContexts(root);
  const steps: PaintInstruction[] = [];
  resolveContextPaintOrder(rootContextId, contexts, contextByBox, steps);
  return steps;
}

function computeEffectiveOpacity(box: RenderBox): number {
  let opacity = box.opacity;
  if (box.filter) {
    for (const fn of box.filter) {
      if (fn.kind === "opacity") opacity *= fn.value;
    }
  }
  return Math.max(0, Math.min(1, opacity));
}

function resolveContextPaintOrder(
  contextId: StackingContextId,
  contexts: Map<StackingContextId, StackingContextNode>,
  contextByBox: WeakMap<RenderBox, StackingContextNode>,
  out: PaintInstruction[],
): void {
  const context = contexts.get(contextId);
  if (!context) return;

  const rootBox = context.box;
  out.push({ type: "box", box: rootBox });

  const descendants: RenderBox[] = [];
  collectDescendantsInContext(rootBox, contextId, contextByBox, descendants);

  const negativeZ: RenderBox[] = [];
  const normalFlowAutoZ: RenderBox[] = [];
  const positionedNonNegative: RenderBox[] = [];

  for (const box of descendants) {
    const flags = getStackingFlags(box);
    if (flags.isPositioned && flags.zIndex !== "auto") {
      if (flags.zIndex < 0) negativeZ.push(box);
      else positionedNonNegative.push(box);
    } else {
      normalFlowAutoZ.push(box);
    }
  }

  negativeZ.sort(compareZIndex);
  for (const box of negativeZ) {
    appendBoxOrContext(box, contextId, contexts, contextByBox, out);
  }

  for (const box of normalFlowAutoZ) {
    appendBoxOrContext(box, contextId, contexts, contextByBox, out);
  }

  positionedNonNegative.sort(compareZIndex);
  for (const box of positionedNonNegative) {
    appendBoxOrContext(box, contextId, contexts, contextByBox, out);
  }
}

function compareZIndex(a: RenderBox, b: RenderBox): number {
  const az = getStackingFlags(a).zIndex;
  const bz = getStackingFlags(b).zIndex;
  const aNumeric = az === "auto" ? 0 : az;
  const bNumeric = bz === "auto" ? 0 : bz;
  return aNumeric - bNumeric;
}

function appendBoxOrContext(
  box: RenderBox,
  parentContextId: StackingContextId,
  contexts: Map<StackingContextId, StackingContextNode>,
  contextByBox: WeakMap<RenderBox, StackingContextNode>,
  out: PaintInstruction[],
): void {
  const nested = findContextByBox(box, parentContextId, contextByBox);
  if (!nested) {
    out.push({ type: "box", box });
    return;
  }

  const effectiveOpacity = computeEffectiveOpacity(nested.box);
  if (effectiveOpacity < 1) out.push({ type: "beginOpacity", opacity: effectiveOpacity });
  resolveContextPaintOrder(nested.id, contexts, contextByBox, out);
  if (effectiveOpacity < 1) out.push({ type: "endOpacity" });
}

function collectDescendantsInContext(
  box: RenderBox,
  contextId: StackingContextId,
  contextByBox: WeakMap<RenderBox, StackingContextNode>,
  out: RenderBox[],
): void {
  for (const child of box.children) {
    const childContext = findContextByBox(child, null, contextByBox);
    if (childContext && childContext.id !== contextId) {
      out.push(child);
      continue;
    }

    out.push(child);
    collectDescendantsInContext(child, contextId, contextByBox, out);
  }
}

function findContextByBox(
  box: RenderBox,
  parentContextId: StackingContextId | null,
  contextByBox: WeakMap<RenderBox, StackingContextNode>,
): StackingContextNode | undefined {
  const context = contextByBox.get(box);
  if (!context) return undefined;
  if (parentContextId !== null && context.parentId !== parentContextId) return undefined;
  return context;
}
