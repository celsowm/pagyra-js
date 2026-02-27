import type { RenderBox } from "../types.js";
import type { StackingContextId, StackingContextNode, StackingFlags } from "./types.js";

/**
 * Map a RenderBox to stacking-relevant flags.
 * Scope: only numeric z-index on positioned elements vs auto, per agreed constraints.
 */
export function getStackingFlags(box: RenderBox): StackingFlags {
  const isPositioned = box.positioning.type !== "normal";
  const raw = box.zIndexComputed;
  const hasNumericZ = typeof raw === "number" && Number.isFinite(raw);
  const zIndex: number | "auto" = hasNumericZ ? (raw as number) : "auto";

  const establishesContext = box.establishesStackingContext || (isPositioned && hasNumericZ);

  return { isPositioned, zIndex, establishesContext };
}

interface BuildResult {
  rootContextId: StackingContextId;
  contexts: Map<StackingContextId, StackingContextNode>;
}

/**
 * Build stacking contexts from the RenderBox tree.
 * - Root box always gets a root stacking context.
 * - Positioned elements with numeric z-index create their own stacking context.
 * - Other boxes belong to the nearest ancestor context.
 *
 * This module is SRP: it only builds the context graph; it does NOT decide paint order.
 */
export function buildStackingContexts(root: RenderBox): BuildResult {
  const contexts = new Map<StackingContextId, StackingContextNode>();

  // Root context anchored at the root box.
  const rootContextId: StackingContextId = makeContextId(root, 0);
  const rootContext: StackingContextNode = {
    id: rootContextId,
    box: root,
    parentId: null,
    childContextIds: [],
  };
  contexts.set(rootContextId, rootContext);

  // DFS to assign boxes to contexts / create new ones as needed.
  traverse(root, rootContextId, 1, contexts);

  return { rootContextId, contexts };
}

function traverse(
  box: RenderBox,
  currentContextId: StackingContextId,
  counterStart: number,
  contexts: Map<StackingContextId, StackingContextNode>,
): number {
  let counter = counterStart;

  for (const child of box.children) {
    const flags = getStackingFlags(child);

    if (flags.establishesContext) {
      // Create new stacking context anchored at this child.
      const ctxId = makeContextId(child, counter++);
      const node: StackingContextNode = {
        id: ctxId,
        box: child,
        parentId: currentContextId,
        childContextIds: [],
      };
      contexts.set(ctxId, node);

      const parent = contexts.get(currentContextId);
      if (parent) {
        parent.childContextIds.push(ctxId);
      }

      // Recurse with the new context as current.
      counter = traverse(child, ctxId, counter, contexts);
    } else {
      // Child participates in the current context.
      counter = traverse(child, currentContextId, counter, contexts);
    }
  }

  return counter;
}

function makeContextId(box: RenderBox, suffix: number): StackingContextId {
  // Stable but simple: use box id plus local counter.
  return `${box.id || "ctx"}-${suffix}`;
}
