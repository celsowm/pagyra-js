import { Display, FloatMode, Position } from "../../css/enums.js";
import { LayoutNode } from "../../dom/node.js";

const EPSILON = 0.01;

/**
 * Applies forced CSS page breaks in continuous layout coordinates. The later
 * page-margin mapping turns each usable-height interval into a physical page.
 */
export function applyForcedPageBreaks(root: LayoutNode, usablePageHeight: number): void {
  if (!Number.isFinite(usablePageHeight) || usablePageHeight <= 0) {
    return;
  }

  let accumulatedOffset = 0;

  const visit = (node: LayoutNode, isRoot: boolean): void => {
    if (accumulatedOffset !== 0) {
      shiftNodeGeometry(node, accumulatedOffset);
    }

    if (!isRoot && participatesInPageFlow(node)) {
      const beforeOffset = forcedBreakOffset(
        node.style.breakBefore,
        node.box.y,
        usablePageHeight,
      );
      if (beforeOffset > EPSILON) {
        shiftNodeGeometry(node, beforeOffset);
        accumulatedOffset += beforeOffset;
      }
    }

    for (const child of node.children) {
      visit(child, false);
    }

    if (!isRoot && participatesInPageFlow(node)) {
      const bottom = subtreeBottom(node);
      const afterOffset = forcedBreakOffset(
        node.style.breakAfter,
        bottom,
        usablePageHeight,
      );
      if (afterOffset > EPSILON) {
        accumulatedOffset += afterOffset;
      }
    }
  };

  visit(root, true);
}

function participatesInPageFlow(node: LayoutNode): boolean {
  if (node.style.display === Display.None || isInlineDisplay(node.style.display)) {
    return false;
  }
  if (node.style.position === Position.Absolute || node.style.position === Position.Fixed) {
    return false;
  }
  return node.style.float === FloatMode.None;
}

function isInlineDisplay(display: Display): boolean {
  return display === Display.Inline
    || display === Display.InlineBlock
    || display === Display.InlineFlex
    || display === Display.InlineGrid
    || display === Display.InlineTable;
}

function forcedBreakOffset(value: string | undefined, coordinate: number, pageHeight: number): number {
  const normalized = value?.trim().toLowerCase();
  if (normalized !== "page" && normalized !== "left" && normalized !== "right") {
    return 0;
  }

  const quotient = coordinate / pageHeight;
  const rounded = Math.round(quotient);
  let targetPageIndex = Math.abs(quotient - rounded) < EPSILON / pageHeight
    ? rounded
    : Math.floor(quotient) + 1;

  if (normalized === "left") {
    // Page number 1 is a right/recto page; zero-based odd indexes are left pages.
    if (targetPageIndex % 2 === 0) {
      targetPageIndex++;
    }
  } else if (normalized === "right") {
    if (targetPageIndex % 2 !== 0) {
      targetPageIndex++;
    }
  }

  return Math.max(0, targetPageIndex * pageHeight - coordinate);
}

function shiftNodeGeometry(node: LayoutNode, dy: number): void {
  node.box.y += dy;
  node.box.baseline += dy;
  if (node.inlineRuns) {
    for (const run of node.inlineRuns) {
      run.baseline += dy;
    }
  }
}

function subtreeBottom(node: LayoutNode): number {
  let bottom = node.box.y + Math.max(
    node.box.marginBoxHeight,
    node.box.borderBoxHeight,
    node.box.contentHeight,
  );
  for (const child of node.children) {
    bottom = Math.max(bottom, subtreeBottom(child));
  }
  return bottom;
}
