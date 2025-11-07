import type { RenderBox } from "../types.js";
import { buildStackingContexts, getStackingFlags } from "./build-stacking-contexts.js";
import type { PaintStep, StackingContextId, StackingContextNode } from "./types.js";

/**
 * Resolve a global paint order from the RenderBox tree using stacking contexts.
 *
 * Scope (step 1):
 * - Support numeric z-index on positioned elements (absolute/fixed/etc.) vs auto.
 * - Respect DOM order for ties.
 * - Treat each box as an atomic paint unit (background+border+content together).
 * - Keep API simple: return ordered RenderBox list.
 */
export function resolvePaintOrder(root: RenderBox): RenderBox[] {
  const { rootContextId, contexts } = buildStackingContexts(root);
  const steps: PaintStep[] = [];

  resolveContextPaintOrder(rootContextId, contexts, steps);
  return steps.map((s) => s.box);
}

/**
 * Compute paint order within a stacking context and append PaintSteps.
 *
 * Simplified rules (sufficient for our current constraints):
 * For a given context:
 *   1. Paint the context root box itself.
 *   2. Paint descendants with negative z-index (positioned).
 *   3. Paint normal-flow descendants (z-index: auto).
 *   4. Paint positioned descendants with z-index >= 0 in ascending z-index.
 *
 * DOM order is preserved within each group as tie-breaker.
 * Nested stacking contexts are treated as atomic units via recursion.
 */
function resolveContextPaintOrder(
  contextId: StackingContextId,
  contexts: Map<StackingContextId, StackingContextNode>,
  out: PaintStep[],
): void {
  const context = contexts.get(contextId);
  if (!context) return;

  const rootBox = context.box;

  // 1. Paint the context root box as an atomic unit.
  out.push({ box: rootBox });

  // Collect direct descendants belonging to this context (non-root boxes).
  const descendants: RenderBox[] = [];
  collectDescendantsInContext(rootBox, contextId, contexts, descendants);

  const negativeZ: RenderBox[] = [];
  const normalFlowAutoZ: RenderBox[] = [];
  const positionedNonNegative: RenderBox[] = [];

  for (const box of descendants) {
    const flags = getStackingFlags(box);

    if (flags.isPositioned && flags.zIndex !== "auto") {
      const z = flags.zIndex as number;
      if (z < 0) {
        negativeZ.push(box);
      } else {
        positionedNonNegative.push(box);
      }
    } else {
      // Non-positioned or auto z-index participate in the auto flow group.
      normalFlowAutoZ.push(box);
    }
  }

  // 2. Negative z-index positioned descendants (ascending z, DOM order for ties).
  negativeZ.sort((a, b) => {
    const az = (getStackingFlags(a).zIndex as number) ?? 0;
    const bz = (getStackingFlags(b).zIndex as number) ?? 0;
    if (az !== bz) return az - bz;
    return 0; // DOM order already in descendants list.
  });
  for (const box of negativeZ) {
    appendBoxOrContext(box, contextId, contexts, out);
  }

  // 3. Normal flow / auto z-index descendants (DOM order).
  for (const box of normalFlowAutoZ) {
    appendBoxOrContext(box, contextId, contexts, out);
  }

  // 4. Positioned non-negative z-index descendants (ascending z, DOM order ties).
  positionedNonNegative.sort((a, b) => {
    const az = (getStackingFlags(a).zIndex as number) ?? 0;
    const bz = (getStackingFlags(b).zIndex as number) ?? 0;
    if (az !== bz) return az - bz;
    return 0;
  });
  for (const box of positionedNonNegative) {
    appendBoxOrContext(box, contextId, contexts, out);
  }
}

/**
 * Append either a nested stacking context or a regular box.
 * Nested contexts are treated as atomic units: we delegate to resolveContextPaintOrder.
 */
function appendBoxOrContext(
  box: RenderBox,
  parentContextId: StackingContextId,
  contexts: Map<StackingContextId, StackingContextNode>,
  out: PaintStep[],
): void {
  const nested = findContextByBox(box, parentContextId, contexts);
  if (nested) {
    resolveContextPaintOrder(nested.id, contexts, out);
  } else {
    out.push({ box });
  }
}

/**
 * Collect descendants that belong to the given context (i.e. do not start
 * their own stacking context), in DOM order.
 */
function collectDescendantsInContext(
  box: RenderBox,
  contextId: StackingContextId,
  contexts: Map<StackingContextId, StackingContextNode>,
  out: RenderBox[],
): void {
  for (const child of box.children) {
    const childCtx = findContextByBox(child, null, contexts);
    if (childCtx && childCtx.id !== contextId) {
      // Child begins its own stacking context; treat that context atomically later.
      // Do not inline its descendants here.
      out.push(child);
      continue;
    }

    out.push(child);
    collectDescendantsInContext(child, contextId, contexts, out);
  }
}

/**
 * Find a stacking context node anchored at the given box.
 * If parentContextId is provided, only match contexts whose parentId equals it.
 */
function findContextByBox(
  box: RenderBox,
  parentContextId: StackingContextId | null,
  contexts: Map<StackingContextId, StackingContextNode>,
): StackingContextNode | undefined {
  for (const ctx of contexts.values()) {
    if (ctx.box === box && (parentContextId === null || ctx.parentId === parentContextId)) {
      return ctx;
    }
  }
  return undefined;
}
