import { LayoutNode } from "../../dom/node.js";
import { Display } from "../../css/enums.js";
import { resolveLength } from "../../css/length.js";
import { establishesBFC, inFlow, resolveWidthBlock } from "./node-math.js";

const EPSILON = 1e-7;

function isApproximatelyZero(value: number): boolean {
  return Math.abs(value) < EPSILON;
}

function isBlockLevel(node: LayoutNode): boolean {
  switch (node.style.display) {
    case Display.Block:
    case Display.ListItem:
      return true;
    default:
      return false;
  }
}

function isMarginCollapsibleChild(node: LayoutNode): boolean {
  return node.style.display !== Display.None && inFlow(node) && isBlockLevel(node) && !establishesBFC(node);
}

export function collapseMarginSet(margins: readonly number[]): number {
  const positives: number[] = [];
  const negatives: number[] = [];
  for (const margin of margins) {
    if (margin > 0) {
      positives.push(margin);
    } else if (margin < 0) {
      negatives.push(margin);
    }
  }

  if (negatives.length === 0) {
    return positives.length > 0 ? Math.max(...positives) : 0;
  }
  if (positives.length === 0) {
    return Math.min(...negatives);
  }
  return Math.max(...positives) + Math.min(...negatives);
}

export function collapsedGapBetween(
  prevBottomMargin: number,
  nextTopMargin: number,
  parentEstablishesBfc: boolean,
): number {
  if (parentEstablishesBfc) {
    return prevBottomMargin + nextTopMargin;
  }
  return collapseMarginSet([prevBottomMargin, nextTopMargin]);
}

export function findFirstMarginCollapsibleChild(node: LayoutNode): LayoutNode | undefined {
  for (const child of node.children) {
    if (!inFlow(child) || child.style.display === Display.None) {
      continue;
    }
    if (isMarginCollapsibleChild(child)) {
      return child;
    }
    break;
  }
  return undefined;
}

export function findLastMarginCollapsibleChild(node: LayoutNode): LayoutNode | undefined {
  for (let i = node.children.length - 1; i >= 0; i -= 1) {
    const child = node.children[i];
    if (!inFlow(child) || child.style.display === Display.None) {
      continue;
    }
    if (isMarginCollapsibleChild(child)) {
      return child;
    }
    break;
  }
  return undefined;
}

export function canCollapseMarginStart(
  node: LayoutNode,
  containingBlockWidth: number,
  containingBlockHeight: number = containingBlockWidth,
): boolean {
  if (!isBlockLevel(node) || establishesBFC(node)) {
    return false;
  }
  const containerRefs = { containerWidth: containingBlockWidth, containerHeight: containingBlockHeight };
  const paddingTop = resolveLength(node.style.paddingTop, containingBlockHeight, { auto: "zero", ...containerRefs });
  const borderTop = resolveLength(node.style.borderTop, containingBlockHeight, { auto: "zero", ...containerRefs });
  if (!isApproximatelyZero(paddingTop) || !isApproximatelyZero(borderTop)) {
    return false;
  }
  return findFirstMarginCollapsibleChild(node) !== undefined;
}

export function canCollapseMarginEnd(
  node: LayoutNode,
  containingBlockWidth: number,
  containingBlockHeight: number = containingBlockWidth,
): boolean {
  if (!isBlockLevel(node) || establishesBFC(node)) {
    return false;
  }
  const containerRefs = { containerWidth: containingBlockWidth, containerHeight: containingBlockHeight };
  const paddingBottom = resolveLength(node.style.paddingBottom, containingBlockHeight, { auto: "zero", ...containerRefs });
  const borderBottom = resolveLength(node.style.borderBottom, containingBlockHeight, { auto: "zero", ...containerRefs });
  if (!isApproximatelyZero(paddingBottom) || !isApproximatelyZero(borderBottom)) {
    return false;
  }
  return findLastMarginCollapsibleChild(node) !== undefined;
}

export function effectiveMarginTop(
  node: LayoutNode,
  containingBlockWidth: number,
  containingBlockHeight: number = containingBlockWidth,
): number {
  const containerRefs = { containerWidth: containingBlockWidth, containerHeight: containingBlockHeight };
  const ownMargin = resolveLength(node.style.marginTop, containingBlockHeight, { auto: "zero", ...containerRefs });
  if (!isBlockLevel(node)) {
    return ownMargin;
  }
  if (!canCollapseMarginStart(node, containingBlockWidth, containingBlockHeight)) {
    return ownMargin;
  }
  const firstChild = findFirstMarginCollapsibleChild(node);
  if (!firstChild) {
    return ownMargin;
  }
  const childContainingWidth = resolveWidthBlock(node, containingBlockWidth, containingBlockHeight);
  const childMargin = effectiveMarginTop(firstChild, childContainingWidth, containingBlockHeight);
  return collapseMarginSet([ownMargin, childMargin]);
}

export function effectiveMarginBottom(
  node: LayoutNode,
  containingBlockWidth: number,
  containingBlockHeight: number = containingBlockWidth,
): number {
  const containerRefs = { containerWidth: containingBlockWidth, containerHeight: containingBlockHeight };
  const ownMargin = resolveLength(node.style.marginBottom, containingBlockHeight, { auto: "zero", ...containerRefs });
  if (!isBlockLevel(node)) {
    return ownMargin;
  }
  if (!canCollapseMarginEnd(node, containingBlockWidth, containingBlockHeight)) {
    return ownMargin;
  }
  const lastChild = findLastMarginCollapsibleChild(node);
  if (!lastChild) {
    return ownMargin;
  }
  const childContainingWidth = resolveWidthBlock(node, containingBlockWidth, containingBlockHeight);
  const childMargin = effectiveMarginBottom(lastChild, childContainingWidth, containingBlockHeight);
  return collapseMarginSet([ownMargin, childMargin]);
}
