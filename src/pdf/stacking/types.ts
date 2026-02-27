import type { RenderBox } from "../types.js";

export type StackingContextId = string;

/**
 * Represents a stacking context anchored at a particular RenderBox.
 * This structure is intentionally minimal and purely declarative:
 * it does not encode paint-order algorithms.
 */
export interface StackingContextNode {
  /** Unique id for this stacking context. */
  id: StackingContextId;
  /** The box that establishes this stacking context. */
  box: RenderBox;
  /** Parent stacking context id (null for root). */
  parentId: StackingContextId | null;
  /** Child stacking contexts nested inside this one. */
  childContextIds: StackingContextId[];
}

/**
 * Lightweight view of stacking-relevant flags for a RenderBox.
 * This mirrors CSS concepts but stays implementation-agnostic.
 */
export interface StackingFlags {
  /** Whether the element is positioned (absolute, fixed, sticky, etc.). */
  isPositioned: boolean;
  /** Numeric z-index value or "auto" when not explicitly set. */
  zIndex: number | "auto";
  /** Whether this element establishes a new stacking context. */
  establishesContext: boolean;
}

/**
 * Describes a resolved paint step for a single box.
 * Higher-level algorithms will generate ordered sequences of these entries.
 */
export interface PaintStep {
  box: RenderBox;
}

/**
 * A paint instruction in the resolved paint order.
 * - `box`: paint a single RenderBox atomically.
 * - `beginOpacity` / `endOpacity`: wrap a stacking context group in an opacity scope.
 */
export type PaintInstruction =
  | { type: 'box'; box: RenderBox }
  | { type: 'beginOpacity'; opacity: number }
  | { type: 'endOpacity' };
